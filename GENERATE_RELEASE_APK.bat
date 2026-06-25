@echo off
echo ===================================================
echo   PENNY - RELEASE APK GENERATOR
echo ===================================================
echo.
echo [1/3] Building Web Production Assets...
call npm run build

echo.
echo [2/3] Syncing with Android Project...
call npx cap sync android

echo.
echo [3/3] Generating Hardened Signed APK...
cd android
call gradlew.bat assembleRelease

echo.
echo ===================================================
echo   BUILD FINISHED!
echo ===================================================
echo.
echo Your hardened APK should be located at:
echo android\app\build\outputs\apk\release\app-release.apk
echo.
pause
