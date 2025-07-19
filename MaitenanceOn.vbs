Dim fso, file
Set fso = CreateObject("Scripting.FileSystemObject")

' Change this path to match your actual SHIELD folder
Set file = fso.CreateTextFile("C:\Users\49174\Downloads\S.H.I.E.L.D2\maintenance.lock", True)
file.WriteLine "MAINTENANCE ENABLED"
file.Close
