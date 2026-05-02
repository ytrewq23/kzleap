import sib_api_v3_sdk
from sib_api_v3_sdk.rest import ApiException
import random
import string
from dotenv import load_dotenv
import os

load_dotenv()

def generate_code():
    return ''.join(random.choices(string.digits, k=6))

def send_verification_email(to_email: str, code: str, name: str):
    configuration = sib_api_v3_sdk.Configuration()
    configuration.api_key['api-key'] = os.getenv("BREVO_API_KEY")
    
    api_instance = sib_api_v3_sdk.TransactionalEmailsApi(
        sib_api_v3_sdk.ApiClient(configuration)
    )
    
    send_smtp_email = sib_api_v3_sdk.SendSmtpEmail(
        to=[{"email": to_email, "name": name}],
        sender={"email": "forstudyadd@gmail.com", "name": "KZLEAP Platform"},
        subject="KZLEAP — Email Verification Code",
        html_content=f"""
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;">
            <h2 style="color:#0F6E56;">KZLEAP Verification</h2>
            <p>Hello {name},</p>
            <p>Your verification code is:</p>
            <div style="font-size:32px;font-weight:bold;color:#0F6E56;padding:16px;background:#f0faf7;border-radius:8px;text-align:center;letter-spacing:8px;">
                {code}
            </div>
            <p style="color:#666;font-size:13px;">Code expires in 10 minutes.</p>
            <p style="color:#666;font-size:13px;">KZLEAP — Kazakhstan Energy Forecasting Platform</p>
        </div>
        """
    )
    
    try:
        api_instance.send_transac_email(send_smtp_email)
        return True
    except ApiException as e:
        print(f"Email error: {e}")
        return False