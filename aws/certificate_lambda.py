"""AWS Lambda: draws the certificate PDF and stores it in a private S3 bucket.

Environment variable:  CERT_BUCKET  (name of the S3 bucket)
Runtime: Python 3.12, handler  certificate_lambda.handler
Zip this file together with backend/certificate_pdf.py (no extra libraries needed).
Input (sent by the backend):  {cert_id, student_name, exam_title, score, total, issued_on}
"""
import json
import os

import boto3

from certificate_pdf import make_certificate_pdf

s3 = boto3.client("s3")


def handler(event, context):
    pdf = make_certificate_pdf(
        event["student_name"], event["exam_title"], event["score"], event["total"],
        event["issued_on"], event["cert_id"],
    )
    key = f"certificates/{event['cert_id']}.pdf"
    s3.put_object(Bucket=os.environ["CERT_BUCKET"], Key=key, Body=pdf, ContentType="application/pdf")
    return {"statusCode": 200, "body": json.dumps({"key": key})}
