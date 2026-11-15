# Checking uploads

Founders upload ID documents, bank statements and proof of spending, and administrators open them. A
file is therefore checked **before it is stored**, in one place (`storeDocument`), which both the
verification documents and the milestone proof go through. Nothing is saved unless it passes.

## What is checked

| File | Refused when                                                                                          | Otherwise                                                 |
| ---- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| PDF  | It can run scripts, launch programs, carry hidden attachments, submit forms, or is password protected | Stored exactly as uploaded                                |
| JPEG | It is not structurally a JPEG                                                                         | Stored without location, camera details, comments, extras |
| PNG  | It is not structurally a PNG (every chunk's checksum is verified)                                     | Stored without text, EXIF, timestamps, extras             |

Details worth knowing:

- Scripts are often hidden inside compressed parts of a PDF, so those are opened and checked too. Limits
  stop a hostile file from using up the server (no more than 2000 compressed parts, and nothing that
  expands past 8 MB each or 16 MB in total).
- PDF names can be disguised with hex escapes (`/Java#53cript`); these are decoded before checking.
- Ordinary links are allowed, because bank statements and invoices contain them.
- Photos keep their rotation, so a sideways phone photo still opens the right way up. Everything else in
  the EXIF block, including the GPS location, is removed.
- Bytes appended after the end of an image (a common way to smuggle a second file inside) are cut off.

## What this does not do

This is a strict filter for **active content and hidden data**, not an antivirus.

- It does not decode the picture pixels, only checks the file structure.
- PDF parts packed with unusual filters (ASCII85, LZW) are not opened.
- It cannot recognise known malware by signature.

A password-protected PDF is refused because nobody, including the administrator reviewing it, could read
it anyway. Founders are told to upload an unlocked copy.

If you later want signature scanning, run ClamAV on a small server you control and call it from
`scanUpload` after these checks. Avoid third-party scanning APIs, because they would receive your users'
identity documents.

## How to try it

1. Sign in as a founder and open the documents page.
2. Upload a PDF containing the text `/JavaScript`. You should see "can run scripts or carries
   attachments".
3. Upload a phone photo and download it again from Supabase Storage: its location data is gone.
