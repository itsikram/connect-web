# Signs connect.mobileconfig so iOS Settings shows "Signed by Ikramul"
# instead of "Not Signed". Re-run after editing connect.unsigned.mobileconfig.
#
# A self-signed cert named Ikramul is enough to change Not Signed -> Signed by Ikramul.
# iOS may still show the signer as Unverified unless you later replace the
# cert with one issued by a CA that iOS already trusts.

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Security

$webPublic = Join-Path $PSScriptRoot "..\public"
$unsignedPath = Join-Path $webPublic "connect.unsigned.mobileconfig"
$signedPath = Join-Path $webPublic "connect.mobileconfig"
$serverSignedPath = Join-Path $PSScriptRoot "..\..\server\public\connect.mobileconfig"
$certDir = Join-Path $PSScriptRoot "..\certs"
$pfxPath = Join-Path $certDir "ios-profile-signer.pfx"
$cerPath = Join-Path $certDir "ios-profile-signer.cer"

if (-not (Test-Path $unsignedPath)) {
    throw "Missing unsigned profile: $unsignedPath"
}

New-Item -ItemType Directory -Force -Path $certDir | Out-Null

$password = ConvertTo-SecureString "connect-ios-profile-signer" -AsPlainText -Force
$cert = $null

if (Test-Path $pfxPath) {
    $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2(
        $pfxPath,
        $password,
        [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::Exportable
    )
    Write-Host "Using existing signer certificate: $($cert.Subject)"
} else {
    $cert = New-SelfSignedCertificate `
        -Subject "CN=Ikramul, O=Ikramul" `
        -FriendlyName "Connect iOS profile signer (Ikramul)" `
        -CertStoreLocation "Cert:\CurrentUser\My" `
        -KeyAlgorithm RSA `
        -KeyLength 2048 `
        -HashAlgorithm SHA256 `
        -KeyExportPolicy Exportable `
        -KeyUsage DigitalSignature, KeyEncipherment `
        -TextExtension @(
            "2.5.29.37={text}1.3.6.1.5.5.7.3.3,1.3.6.1.5.5.7.3.4",
            "2.5.29.19={text}CA=false"
        ) `
        -NotAfter (Get-Date).AddYears(10)

    $certBytes = $cert.Export(
        [System.Security.Cryptography.X509Certificates.X509ContentType]::Pfx,
        $password
    )
    [System.IO.File]::WriteAllBytes($pfxPath, $certBytes)
    [System.IO.File]::WriteAllBytes($cerPath, $cert.Export(
        [System.Security.Cryptography.X509Certificates.X509ContentType]::Cert
    ))
    Write-Host "Created signer certificate: $($cert.Subject)"
}

$content = [System.IO.File]::ReadAllBytes((Resolve-Path $unsignedPath))
$contentInfo = New-Object System.Security.Cryptography.Pkcs.ContentInfo (,[byte[]]$content)
$signedCms = New-Object System.Security.Cryptography.Pkcs.SignedCms $contentInfo, $false
$cmsSigner = New-Object System.Security.Cryptography.Pkcs.CmsSigner $cert
$cmsSigner.IncludeOption = [System.Security.Cryptography.X509Certificates.X509IncludeOption]::EndCertOnly
$cmsSigner.DigestAlgorithm = New-Object System.Security.Cryptography.Oid "2.16.840.1.101.3.4.2.1"
$signedCms.ComputeSignature($cmsSigner)
$encoded = $signedCms.Encode()

[System.IO.File]::WriteAllBytes($signedPath, $encoded)
$serverDir = Split-Path $serverSignedPath -Parent
if (Test-Path $serverDir) {
    [System.IO.File]::WriteAllBytes($serverSignedPath, $encoded)
}

Write-Host "Signed $($encoded.Length) bytes -> $signedPath"
Write-Host "iOS should now show Signed by Ikramul (may still be Unverified until a trusted CA cert is used)."
