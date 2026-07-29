import os
os.environ['IAM_DATA_DIR'] = r'D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\mate-platform-backend\.tmp-iam-data'
import sys
sys.path.insert(0, r'D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\mate-platform-backend\packages\mate-tech-iam\src')
sys.path.insert(0, r'D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\mate-platform-backend\packages\mate-common\src')
import uvicorn
uvicorn.run('mate_tech_iam.main:app', host='127.0.0.1', port=8102)