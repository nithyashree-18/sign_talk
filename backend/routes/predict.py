from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import recognizer

router = APIRouter(prefix="/api", tags=["recognition"])


class Frame(BaseModel):
    image: str   # a JPEG as a base64 data URL, sent by the browser


def get_rec_or_503():
    rec = recognizer.get_recognizer()
    if rec is None:
        raise HTTPException(
            status_code=503,
            detail="Model not found. Train it first: python ml/step4_train.py",
        )
    return rec


@router.get("/model-info")
def model_info():
    return {"classes": get_rec_or_503().classes}


@router.post("/predict")
def predict(frame: Frame):
    try:
        return get_rec_or_503().predict(frame.image)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))