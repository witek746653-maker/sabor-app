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
    $duration = ""
    for ($i = 0; $i -lt 300; $i++) {
        $val = $folder.GetDetailsOf($fileItem, $i)
        if ($val -match "^\d{2}:\d{2}:\d{2}$") {
            $duration = $val
            break
        }
    }
    Write-Output "$file : $duration"
}
