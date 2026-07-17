import sys
print(sys.version)
with open('pyversion.txt','w') as f:
    f.write(sys.version)
