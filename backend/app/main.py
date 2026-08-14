from fastapi import FastAPI


def create_app() -> FastAPI:
    app = FastAPI(title="研发任务智能统计与工时分析平台")

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    return app
