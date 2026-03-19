# Contributing to AbuseBox

Thanks for your interest in contributing! Here's how to get started.

## Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/<your-username>/abusebox.git
   cd abusebox
   ```
3. Create a new branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
4. Set up the development environment (see [README.md](README.md#quick-start))

## Development Workflow

### Backend

```bash
cd backend
cp .env.example .env
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8100 --reload
```

### Frontend

```bash
cd frontend
cp .env.example .env
yarn install
yarn dev
```

### Before Submitting

- **Backend:** Ensure all Python files compile without errors:
  ```bash
  cd backend
  python -m py_compile $(find app -name '*.py')
  ```
- **Frontend:** Ensure the project builds and passes linting:
  ```bash
  cd frontend
  yarn build
  yarn lint
  ```

## Submitting a Pull Request

1. Commit your changes with a clear, descriptive message
2. Push your branch to your fork
3. Open a Pull Request against the `main` branch
4. Describe **what** you changed and **why**

## Guidelines

- Keep PRs focused — one feature or fix per PR
- Follow existing code style and patterns
- Update documentation if your change affects user-facing behavior
- Add yourself to [CONTRIBUTORS.txt](CONTRIBUTORS.txt) in your first PR

## Reporting Issues

- Use [GitHub Issues](https://github.com/bekkaze/abusebox/issues) to report bugs or request features
- Include steps to reproduce, expected behavior, and actual behavior for bug reports
- Check existing issues before opening a new one

## Code of Conduct

Be respectful and constructive. We're all here to build something useful together.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
