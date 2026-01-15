$HostName = "85.198.98.16"            # Server IP or domain
$UserName = "root"                    # SSH user
$RemoteRoot = "/var/www/sabor-app"    # Project path on server (where wsgi.py lives)
$ServiceName = "sabor.service"        # systemd service that runs Gunicorn/Flask


# $SshKeyPath = "$env:USERPROFILE\.ssh\id_ed25519"
