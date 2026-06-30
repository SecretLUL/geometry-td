@echo off
echo Pushing changes to GitHub...
git commit -am "Deploy: Auto-commit before going live"
git push

echo Connecting to NAS and starting remote build...
ssh user@your_nas_ip "cd /path/to/geometry-td && chmod +x deploy.sh && ./deploy.sh"

echo All done!
pause
