param([string]$ExpectedIdentity = 'JustStone.3453441DD0CC3', [switch]$ProbeRuntime)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$window = $null
try {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  Add-Type -AssemblyName System.Windows.Forms
  [Windows.Services.Store.StoreContext,Windows.Services.Store,ContentType=WindowsRuntime] | Out-Null
  [Windows.Services.Store.StorePackageUpdate,Windows.Services.Store,ContentType=WindowsRuntime] | Out-Null
  [Windows.ApplicationModel.Package,Windows.ApplicationModel,ContentType=WindowsRuntime] | Out-Null
  if (-not $ProbeRuntime) {
    try { $package = [Windows.ApplicationModel.Package]::Current } catch { throw 'not-packaged' }
    if ($package.Id.Name -cne $ExpectedIdentity) { throw 'wrong-package' }
  }
  Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
namespace BetterNoteStore {
 [ComImport, Guid("3E68D4BD-7135-4D10-8018-9FB6D9F33FA1"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
 interface IInitializeWithWindow { void Initialize(IntPtr hwnd); }
 public static class WindowOwner {
  public static void Initialize(object context, IntPtr hwnd) { ((IInitializeWithWindow)context).Initialize(hwnd); }
 }
}
"@
  $window = New-Object System.Windows.Forms.Form
  $window.ShowInTaskbar = $false
  $context = [Windows.Services.Store.StoreContext]::GetDefault()
  [BetterNoteStore.WindowOwner]::Initialize($context, $window.Handle)
  $resultType = [System.Collections.Generic.IReadOnlyList[Windows.Services.Store.StorePackageUpdate]]
  $asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.IsGenericMethodDefinition -and $_.GetGenericArguments().Count -eq 1 -and
    $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
  } | Select-Object -First 1
  if (-not $asTask) { throw 'runtime-unavailable' }
  if ($ProbeRuntime) {
    @{status='runtime-ready';hasUpdate=$false} | ConvertTo-Json -Compress
  } else {
    # This only queries updates. It never downloads, installs or restarts an app.
    $operation = $context.GetAppAndOptionalStorePackageUpdatesAsync()
    $task = $asTask.MakeGenericMethod([System.Type[]]@($resultType)).Invoke($null, @($operation))
    $deadline = [DateTime]::UtcNow.AddSeconds(12)
    while (-not $task.IsCompleted) {
      if ([DateTime]::UtcNow -gt $deadline) { $operation.Cancel(); throw 'store-timeout' }
      [System.Windows.Forms.Application]::DoEvents()
      Start-Sleep -Milliseconds 25
    }
    $updates = $task.GetAwaiter().GetResult()
    $count = @($updates | Where-Object { $_.Package.Id.Name -ceq $ExpectedIdentity }).Count
    @{status=$(if($count -gt 0){'available'}else{'current'});hasUpdate=($count -gt 0);count=$count;packageName=$package.Id.Name} | ConvertTo-Json -Compress
  }
} catch {
  $reason = 'store-unavailable'
  if ($_.Exception.Message -in @('not-packaged','wrong-package','runtime-unavailable','store-timeout')) { $reason = $_.Exception.Message }
  @{status='unavailable';hasUpdate=$false;reason=$reason} | ConvertTo-Json -Compress
} finally { if($window){$window.Dispose()} }

