<?php
/**
 * SMTP + recipient settings for send-quote.php.
 *
 * This sends mail through Gmail's own SMTP server (not GoDaddy's mail
 * server), which is what actually gets it reliably into a Gmail inbox
 * instead of spam. That means:
 *
 *  - `smtp_username` must be a full Gmail address.
 *  - `smtp_password` must be a 16-character Gmail "App Password" — NOT
 *    the normal Gmail login password. Generate one at
 *    https://myaccount.google.com/apppasswords (the Gmail account needs
 *    2-Step Verification turned on first, or that page won't appear).
 *  - Gmail's SMTP server rejects a "From" address that isn't the
 *    authenticated account (or a verified alias of it), so `from_email`
 *    below must match `smtp_username`.
 *
 * Keep this file's real password out of version control / off any public
 * repo. On GoDaddy cPanel, upload it as a normal file — it isn't served
 * as a static file (see the .htaccess deny rule next to it), but PHP on
 * that same server can still `require` it.
 */
return [
    'smtp_host'     => 'smtp.gmail.com',
    'smtp_port'     => 587,
    'smtp_secure'   => 'tls',

    'smtp_username' => 'hyadbysal@gmail.com',       // Gmail account that SENDS the mail
    'smtp_password' => 'REPLACE_WITH_APP_PASSWORD', // 16-char Gmail App Password — see note above

    'from_email'    => 'hyadbysal@gmail.com',       // must match smtp_username (Gmail requirement)
    'from_name'     => 'BISliv Website',

    'to_email'      => 'hyadbysal@gmail.com',       // where quote requests land
    'to_name'       => 'BISliv',
];
