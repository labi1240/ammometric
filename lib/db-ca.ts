// Pinned CA for the self-signed PgBouncer cert on the VPS (172.237.137.254:6543).
// This is a PUBLIC certificate (the server presents it to every client), so it is
// safe to commit. It is combined with the system root CAs in lib/prisma.ts so the
// app can verify the full TLS chain (sslmode=verify-full equivalent) without
// shipping a file or env var. SHA-256: 2B:8D:FD:B3:6F:A9:13:E5:78:00:BE:00:14:BD:90:63:E6:39:AF:3A:60:23:1C:80:D2:EC:74:07:16:6D:BC:2F
//
// If PgBouncer's cert is ever regenerated, replace the PEM below with:
//   openssl s_client -starttls postgres -connect 172.237.137.254:6543 -showcerts </dev/null 2>/dev/null | openssl x509
export const VPS_DB_CA = `-----BEGIN CERTIFICATE-----
MIIDJjCCAg6gAwIBAgIUG4Zls3iP5OS7LgMoH19apXasVA0wDQYJKoZIhvcNAQEL
BQAwGjEYMBYGA1UEAwwPMTcyLjIzNy4xMzcuMjU0MB4XDTI2MDYwNDIxMjI1OVoX
DTM2MDYwMTIxMjI1OVowGjEYMBYGA1UEAwwPMTcyLjIzNy4xMzcuMjU0MIIBIjAN
BgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtd8gZQ6SpDSD5pNg5qWF0T1OqzH0
yA2k+MHBzx09uoiclqePX7f9V2rnSbbvkrX87+sueHfJ51raYLaJnxGEOpypeKTc
dtyp+eG6xF7Jjb9y0/L4e3vDoQn0l/5AAjFOG+PE/kiY9CIBK+6q2d+1p3Va3pKx
o73+uPmrqjeljR52gA9mwTRcgW5zcgFaJYqHk7IOKBUANsILeHv9Jb1WVzH0ozQE
eSALuqr1Gk1sDxGSVHQQOHQEThTI/SHBIAYTlBUujLQEsgXeGOMmpHnKTkgmBbCH
GLhYbUQXCpBTE0qhy873fInuwGjuRT9DzazK1wDKTXi7ZSq+utDhIJhtKQIDAQAB
o2QwYjAdBgNVHQ4EFgQUR5UiDodPjwj9vt/1g9FWh0RpnN8wHwYDVR0jBBgwFoAU
R5UiDodPjwj9vt/1g9FWh0RpnN8wDwYDVR0TAQH/BAUwAwEB/zAPBgNVHREECDAG
hwSs7Yn+MA0GCSqGSIb3DQEBCwUAA4IBAQBu9oG5uTmfT3nTu3ThnxSlAKFyQXIt
Olur5x8SAFkgRsXB2DNFmgUUjjWSumV1opAjxCRY6gEGFTeFSMqSGqosBn5lj96o
SC/uY9BX1iZBwt5YuNjAPlOuTD9urOr1ThSFXcdsN6c7AXKRHcDRygrTFlzPK0NL
VF7olKKlkspKL+8oQ2qjkQamZ99c6oe5vCT/WQbRoyzeJjxYdp8eZl1fJLcFUsYE
zSR4kYw8OLPMl1NZ2yTF96bsmk9a5HI+9dJiow+WnQZiXh/seSlCxV8E1DRq5Ex5
DBjoDhF2uFXGAAGlOBSapro7ggsjhPyyEr5HtPMfS0Pf62bALfhvG/lu
-----END CERTIFICATE-----`
