Dim fso
Set fso = CreateObject("Scripting.FileSystemObject")

' Change path to match your setup
If fso.FileExists("[Your Path]/maintenance.lock") Then
  fso.DeleteFile "[Your Path]\maintenance.lock"
End If
