@echo off
echo ========================================
echo Committing Deployment Infrastructure
echo ========================================
echo.

REM Close any applications that might lock Git
echo Ensuring Git is ready...
timeout /t 2 /nobreak > nul

REM Add all deployment infrastructure files
echo Adding files to Git...
git add .env.example
git add server/.env.example
git add package.json
git add package-lock.json
git add server/package.json
git add .github/
git add database/
git add playwright.config.js
git add server/run-all-migrations.js
git add server/tests/
git add server/vercel.json
git add src/components/ErrorBoundary.js
git add src/components/__tests__/
git add src/setupTests.js
git add src/index.js
git add tests/
git add vercel.json
git add *.md
git add src/components/GanttChart.js
git add src/components/GanttView.js

echo.
echo Files staged for commit
echo.

REM Commit with detailed message
git commit -m "Add complete deployment infrastructure

- 3-tier environment setup (test, staging, production)
- Comprehensive .env.example with all variables
- Database migrations with runner script
- Vercel configuration for frontend and backend
- GitHub Actions CI/CD pipelines
- Jest + React Testing Library unit tests
- Supertest backend API tests
- Playwright E2E tests with OAuth workaround
- React Error Boundary component
- Complete documentation (7 guides, 2500+ lines)
- Fixed Gantt chart scrolling issue
- Removed debug console statements

All infrastructure ready for deployment to Vercel (free tier).
Cost: $0/month using Vercel + Neon + Sentry free tiers.

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"

echo.
echo ========================================
echo Commit Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Push to master: git push origin master
echo 2. Push to test: git checkout test ^&^& git merge master ^&^& git push origin test
echo 3. Push to staging: git checkout staging ^&^& git merge master ^&^& git push origin staging
echo 4. Return to master: git checkout master
echo.
pause
