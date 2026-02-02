$folderPath = "d:\GitHub\sabor-app\frontend\public\media"
$files = @(
    "podcast-cocktail-menu-concept-and-philosophy.mp3",
    "podcast-kak-pit-duhi-i-tryufelnoe-maslo.mp3",
    "podcast-reasons-to-drink-by-the-glass-guide.mp3",
    "podcast-reasons-to-try-coravin-wine.mp3"
)

$shell = New-Object -ComObject Shell.Application
$folder = $shell.Namespace($folderPath)

foreach ($file in $files) {
    $fileItem = $folder.ParseName($file)
    # Duration is usually index 27 in Windows Explorer properties, but it can vary.
    # Let's try to find the "Duration" or "Длительность" property.
    
    $duration = ""
    for ($i = 0; $i -lt 300; $i++) {
        $name = $folder.GetDetailsOf($null, $i)
        if ($name -eq "Length" -or $name -eq "Duration" -or $name -eq "Длительность" -or $name -eq "Продолжительность") {
            $duration = $folder.GetDetailsOf($fileItem, $i)
            break
        }
    }
    
    Write-Output "$file : $duration"
}
