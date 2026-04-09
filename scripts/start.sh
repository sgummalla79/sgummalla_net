#!/bin/sh
set -e

# Write SAML certs from environment secrets to disk
mkdir -p certs

if [ -n "$SAML_PRIVATE_KEY" ]; then
  printf '%s' "$SAML_PRIVATE_KEY" > certs/idp.key
fi

if [ -n "$SAML_CERTIFICATE" ]; then
  printf '%s' "$SAML_CERTIFICATE" > certs/idp.crt
fi

exec node server.js