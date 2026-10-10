from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import exam, predict, signs

app = FastAPI(title="Sign Talk API")

# allow the React dev server (Vite) to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

# each person adds their own routers here, one line each
app.include_router(signs.router)
app.include_router(predict.router)
app.include_router(exam.router)