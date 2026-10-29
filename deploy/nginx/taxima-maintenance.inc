# Deploy maintenance page (flag: /var/www/taxima-maintenance/enabled)
# Used with: error_page 503 /maintenance.html;

location = /maintenance.html {
    internal;
    root /var/www/taxima-maintenance;
    default_type text/html;
    charset utf-8;
    add_header Retry-After 300 always;
}
