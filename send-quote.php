<?php
/**
 * Handles POSTs from contact.html's #quoteForm (assets/js/quote-form.js)
 * and emails the details via Gmail SMTP (PHPMailer, vendored under
 * assets/vendor/phpmailer/ — no Composer needed on shared hosting).
 * Uploaded documents are saved under uploads/ rather than attached
 * directly, since the form allows up to 5 files x 15MB and mailbox
 * attachment limits (Gmail's incoming cap is ~25MB) would bounce that.
 */

declare(strict_types=1);

require __DIR__ . '/assets/vendor/phpmailer/src/Exception.php';
require __DIR__ . '/assets/vendor/phpmailer/src/PHPMailer.php';
require __DIR__ . '/assets/vendor/phpmailer/src/SMTP.php';

use PHPMailer\PHPMailer\Exception as PHPMailerException;
use PHPMailer\PHPMailer\PHPMailer;

header('Content-Type: application/json; charset=utf-8');

function respond(bool $success, string $message): void
{
    http_response_code($success ? 200 : 400);
    echo json_encode(['success' => $success, 'message' => $message]);
    exit;
}

function field(string $key): string
{
    if (!isset($_POST[$key]) || is_array($_POST[$key])) {
        return '';
    }
    return trim(str_replace(["\r", "\n"], ' ', (string) $_POST[$key]));
}

function row(string $label, string $value): string
{
    if ($value === '') {
        return '';
    }
    return '<tr><td style="padding:6px 12px;color:#666;font-size:13px;white-space:nowrap;vertical-align:top;">'
        . htmlspecialchars($label, ENT_QUOTES, 'UTF-8')
        . '</td><td style="padding:6px 12px;font-size:14px;">'
        . nl2br(htmlspecialchars($value, ENT_QUOTES, 'UTF-8'))
        . '</td></tr>';
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(false, 'Invalid request method.');
}

$config = require __DIR__ . '/mail-config.php';

// Honeypot field (see contact.html: a visually-hidden "website" input).
// Real visitors never fill it; bots filling every field usually do.
// Pretend success so bots don't learn to leave it blank.
if (!empty($_POST['website'])) {
    respond(true, 'Thanks! We have received your request and will be in touch shortly.');
}

$fullName = field('fullName');
$phone = field('phone');
$email = field('email');
$city = field('city');
$consent = field('consent');

$services = [];
if (isset($_POST['service']) && is_array($_POST['service'])) {
    foreach ($_POST['service'] as $s) {
        if (is_string($s) && $s !== '') {
            $services[] = $s;
        }
    }
}

$errors = [];
if ($fullName === '') {
    $errors[] = 'Full name is required.';
}
if ($phone === '') {
    $errors[] = 'Phone number is required.';
}
if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors[] = 'A valid email address is required.';
}
if ($city === '') {
    $errors[] = 'City / location is required.';
}
if (count($services) === 0) {
    $errors[] = 'Select at least one service.';
}
if ($consent === '') {
    $errors[] = 'Please agree to be contacted to submit your request.';
}

if ($errors !== []) {
    respond(false, implode(' ', $errors));
}

$serviceLabels = [
    'construction' => 'Building Construction',
    'interior' => 'Interior Design',
    'solar' => 'Solar Solutions',
    'renovation' => 'Renovation',
    'other' => 'Other',
];
$serviceNames = array_map(
    static fn (string $s): string => $serviceLabels[$s] ?? $s,
    $services
);

// ---------------- file uploads ----------------

$allowedExt = ['pdf', 'jpg', 'jpeg', 'png', 'dwg'];
$maxFileSize = 15 * 1024 * 1024;
$maxFiles = 5;
$uploadDir = __DIR__ . '/uploads/';

$savedFiles = [];
$fileErrors = [];

if (!empty($_FILES['documents']) && is_array($_FILES['documents']['name'])) {
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }

    $count = count($_FILES['documents']['name']);
    for ($i = 0; $i < $count && count($savedFiles) < $maxFiles; $i++) {
        $uploadError = $_FILES['documents']['error'][$i];
        if ($uploadError === UPLOAD_ERR_NO_FILE) {
            continue;
        }

        $origName = (string) $_FILES['documents']['name'][$i];

        if ($uploadError !== UPLOAD_ERR_OK) {
            $fileErrors[] = $origName . ': upload error.';
            continue;
        }

        $tmpPath = (string) $_FILES['documents']['tmp_name'][$i];
        $size = (int) $_FILES['documents']['size'][$i];
        $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));

        if (!in_array($ext, $allowedExt, true)) {
            $fileErrors[] = $origName . ': unsupported file type.';
            continue;
        }
        if ($size > $maxFileSize) {
            $fileErrors[] = $origName . ': exceeds 15MB.';
            continue;
        }
        if (!is_uploaded_file($tmpPath)) {
            $fileErrors[] = $origName . ': invalid upload.';
            continue;
        }

        $safeBase = preg_replace('/[^A-Za-z0-9_\-]/', '_', pathinfo($origName, PATHINFO_FILENAME));
        $uniqueName = date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '_' . $safeBase . '.' . $ext;
        $destPath = $uploadDir . $uniqueName;

        if (move_uploaded_file($tmpPath, $destPath)) {
            $savedFiles[] = ['name' => $origName, 'saved_as' => $uniqueName, 'size' => $size];
        } else {
            $fileErrors[] = $origName . ': could not be saved.';
        }
    }
}

// ---------------- build email ----------------

$html = '<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;">';
$html .= '<h2 style="margin:0 0 16px;">New Quote Request — BISliv</h2>';
$html .= '<table style="width:100%;border-collapse:collapse;">';
$html .= row('Full Name', $fullName);
$html .= row('Phone', $phone);
$html .= row('Email', $email);
$html .= row('City / Location', $city);
$html .= row('Services', implode(', ', $serviceNames));

if (in_array('construction', $services, true)) {
    $html .= row('— Property Type', field('propertyTypeConstruction'));
    $html .= row('— Plot / Built-up Area', field('plotArea'));
    $html .= row('— Number of Floors', field('floors'));
    $html .= row('— Project Location', field('projectLocationConstruction'));
    $html .= row('— Construction Stage', field('constructionStage'));
}
if (in_array('interior', $services, true)) {
    $html .= row('— Property Type', field('propertyTypeInterior'));
    $html .= row('— Approx. Area (sq.ft.)', field('areaInterior'));
    $html .= row('— Rooms / Spaces', field('roomsSpaces'));
    $html .= row('— Interior Requirement', field('interiorRequirement'));
    $html .= row('— Preferred Style', field('preferredStyle'));
}
if (in_array('solar', $services, true)) {
    $html .= row('— Property Type', field('propertyTypeSolar'));
    $html .= row('— Avg. Monthly Electricity Bill', field('electricityBill'));
    $html .= row('— Required Solar Capacity', field('solarCapacity'));
    $html .= row('— Roof Type', field('roofType'));
    $html .= row('— Solar Requirement', field('solarRequirement'));
}

$html .= row('Budget', field('budget'));
$html .= row('Timeline', field('timeline'));
$html .= row('How they heard about us', field('hearAboutUs'));
$html .= row('Message', field('message'));

if ($savedFiles !== []) {
    $lines = array_map(
        static fn (array $f): string => htmlspecialchars($f['name'], ENT_QUOTES, 'UTF-8')
            . ' (' . round($f['size'] / 1024) . ' KB) — saved as uploads/'
            . htmlspecialchars($f['saved_as'], ENT_QUOTES, 'UTF-8'),
        $savedFiles
    );
    $html .= row('Uploaded Files', implode("\n", $lines));
}
if ($fileErrors !== []) {
    $html .= row('File Upload Issues', implode("\n", $fileErrors));
}

$html .= '</table>';
$html .= '<p style="color:#999;font-size:12px;margin-top:24px;">Submitted '
    . htmlspecialchars(date('Y-m-d H:i:s'), ENT_QUOTES, 'UTF-8')
    . ' from IP ' . htmlspecialchars($_SERVER['REMOTE_ADDR'] ?? 'unknown', ENT_QUOTES, 'UTF-8')
    . '</p>';
$html .= '</div>';

$altBody = strip_tags(str_replace(['<br>', '<br/>', '<br />'], "\n", $html));

// ---------------- send via Gmail SMTP ----------------

$mail = new PHPMailer(true);

try {
    $mail->isSMTP();
    $mail->Host = $config['smtp_host'];
    $mail->SMTPAuth = true;
    $mail->Username = $config['smtp_username'];
    $mail->Password = $config['smtp_password'];
    $mail->SMTPSecure = $config['smtp_secure'];
    $mail->Port = $config['smtp_port'];

    $mail->setFrom($config['from_email'], $config['from_name']);
    $mail->addAddress($config['to_email'], $config['to_name']);
    $mail->addReplyTo($email, $fullName);

    $mail->isHTML(true);
    $mail->CharSet = 'UTF-8';
    $mail->Subject = 'New Quote Request from ' . $fullName . ' (' . implode(', ', $serviceNames) . ')';
    $mail->Body = $html;
    $mail->AltBody = $altBody;

    $mail->send();

    respond(true, 'Thanks! We have received your request and will be in touch shortly.');
} catch (PHPMailerException $e) {
    error_log('BISliv quote-form mail error: ' . $mail->ErrorInfo);
    respond(false, 'Sorry, something went wrong sending your request. Please try again or contact us directly.');
}
