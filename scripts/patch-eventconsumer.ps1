$f = 'TECH-MSG\src\main\java\com\metaplatform\msg\consumer\EventConsumerRegistrar.java'
$c = Get-Content -Encoding UTF8 $f -Raw
$old = 'registry.registerListenerContainer(endpoint, consumerFactory, false);'
$new = [string]::Format('        @SuppressWarnings({{"rawtypes","unchecked"}}){0}        registry.registerListenerContainer((MethodKafkaListenerEndpoint) endpoint, (org.springframework.kafka.core.ConsumerFactory) consumerFactory, false);', [Environment]::NewLine)
$updated = $c -replace [regex]::Escape($old), $new
Set-Content -Encoding UTF8 $f $updated
Write-Output "patched"
