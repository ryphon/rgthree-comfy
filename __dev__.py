import subprocess
import os
import shutil

subprocess.run(["tsc"])

THIS_DIR=os.path.dirname(os.path.abspath(__file__))
DIR_DEV_JS=os.path.abspath(f'{THIS_DIR}/js')
DIR_WEB_JS=os.path.abspath(f'{THIS_DIR}/../../web/extensions/rgthree')

shutil.rmtree(DIR_WEB_JS)
shutil.copytree(DIR_DEV_JS, DIR_WEB_JS, dirs_exist_ok=True)