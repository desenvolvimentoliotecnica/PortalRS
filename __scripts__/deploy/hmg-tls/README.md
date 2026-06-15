# TLS Entra ID no HMG — arquivos de apoio
#
# No servidor 10.0.0.80:
# - API Docker escuta só em 127.0.0.1:5001 (HTTP interno)
# - Nginx no host escuta 0.0.0.0:5000 (HTTPS, cert autoassinado)
# - Authentication__ApiBaseUrl=https://10.0.0.80:5000
#
# Ver docs/HMG-ENTRA-TLS.md
