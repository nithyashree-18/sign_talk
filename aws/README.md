# Certificates on AWS (optional, switch on when you have an account)

By default the backend draws the certificate itself (`CERT_BACKEND=local`), so the demo never needs the internet.
To use Lambda + S3 instead:

1. S3: create a bucket with **Block all public access** on. Certificates are only served through short-lived links.
2. Lambda: Python 3.12. Upload a zip containing `certificate_lambda.py` and `backend/certificate_pdf.py`.
   Handler `certificate_lambda.handler`. Environment variable `CERT_BUCKET=<your bucket>`.
   Role permission: `s3:PutObject` on `<bucket>/certificates/*` only.
3. Backend machine: `pip install boto3`, AWS credentials that can `lambda:InvokeFunction` on this function
   and `s3:GetObject` on `<bucket>/certificates/*`.
4. Start the backend with:
   `CERT_BACKEND=lambda CERT_LAMBDA_NAME=<function name> CERT_BUCKET=<bucket> uvicorn main:app`
   (PowerShell: `$env:CERT_BACKEND="lambda"` and so on, before running uvicorn.)

Not tested against a real AWS account from here. Test it once before you rely on it.
