.PHONY: test backend-test frontend-test install

test: backend-test frontend-test

backend-test:
	cd backend && python -m pytest -q

frontend-test:
	cd frontend && npx vitest run

install:
	cd backend && pip install -r requirements.txt
	cd frontend && npm install
