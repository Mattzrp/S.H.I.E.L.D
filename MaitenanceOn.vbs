Dim fso, file
Set fso = CreateObject("Scripting.FileSystemObject")

' Change this path to match your actual SHIELD folder
Set file = fso.CreateTextFile("[Your Path]\maintenance.lock", True)
file.WriteLine "MAINTENANCE ENABLED"
file.Close
