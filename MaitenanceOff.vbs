Dim fso
Set fso = CreateObject("Scripting.FileSystemObject")

' Change path to match your setup
If fso.FileExists("C:\Users\49174\Downloads\S.H.I.E.L.D2\maintenance.lock") Then
  fso.DeleteFile "C:\Users\49174\Downloads\S.H.I.E.L.D2\maintenance.lock"
End If
