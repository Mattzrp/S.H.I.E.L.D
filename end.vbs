Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "taskkill /F /IM node.exe", 0, True
