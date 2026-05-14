from sqlalchemy import create_engine, Column, String, DateTime, Integer
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import hashlib
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    email = Column(String, primary_key=True)
    name = Column(String)
    role = Column(String)
    password_hash = Column(String)
    status = Column(String, default="pending")

class LoginLog(Base):
    __tablename__ = "login_logs"
    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow)
    ip = Column(String)
    success = Column(String)

class VerificationCode(Base):
    __tablename__ = "verification_codes"
    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String)
    code = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    used = Column(String, default="no")

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

class Dataset(Base):
    __tablename__ = "datasets"
    id = Column(Integer, primary_key=True, autoincrement=True)
    dataset_id = Column(String, unique=True)
    filename = Column(String)
    source = Column(String)
    uploaded_by = Column(String)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    file_path = Column(String)

def init_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    if not db.query(User).first():
        users = [
            User(email="ali@kzleap.kz",    name="Ali B.",    role="analyst",     status="active", password_hash=hash_password("kzleap2026")),
            User(email="aliya@kzleap.kz",  name="Aliya S.",  role="researcher",  status="active", password_hash=hash_password("kzleap2026")),
            User(email="aizada@kzleap.kz", name="Aizada Y.", role="policymaker", status="active", password_hash=hash_password("kzleap2026")),
            User(email="admin@kzleap.kz",  name="Admin",     role="admin",       status="active", password_hash=hash_password("admin2026")),
        ]
        db.add_all(users)
        db.commit()
    db.close()