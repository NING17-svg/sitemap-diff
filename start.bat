@echo off
echo Checking for virtual environment...

IF NOT EXIST "venv\Scripts\activate.bat" (
    echo "venv\Scripts\activate.bat" not found.
    echo Please make sure you have created the virtual environment using "python -m venv venv"
    pause
    exit
)

echo Activating virtual environment...
call venv\Scripts\activate

echo Starting the site-bot...
python site-bot.py
pause 