from dotenv import load_dotenv
import os

# 1. 检查加载.env文件之前的值
print(f"DEBUG: Before load_dotenv, TELEGRAM_BOT_TOKEN is: {os.environ.get('TELEGRAM_BOT_TOKEN')}")

load_dotenv(verbose=True)

# 2. 检查加载.env文件之后的值
print(f"DEBUG: After load_dotenv, TELEGRAM_BOT_TOKEN is: {os.environ.get('TELEGRAM_BOT_TOKEN')}")

telegram_config = {
    "token": os.environ.get("TELEGRAM_BOT_TOKEN", ""),
    "target_chat": os.environ.get("TELEGRAM_TARGET_CHAT"),  # 不设默认值，强制要求配置
}

discord_config = {
    "token": os.environ.get("DISCORD_TOKEN", ""),
}
