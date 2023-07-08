(function() {
    let map;
    let geocoder;
    let bounds;
    let markers = [];
    let markerCluster;
    let markerColor = 'red'; // Default marker color

    function initMap() {
        map = new google.maps.Map(document.getElementById('map'), {
            center: {lat: 38.662, lng: -40.993},
            zoom: 3,
            mapTypeControl: false,
            fullscreenControl: true,
            fullscreenControlOptions: {
                position: google.maps.ControlPosition.RIGHT_BOTTOM
            },
            streetViewControl: false
        });

        geocoder = new google.maps.Geocoder();
        bounds = new google.maps.LatLngBounds();

        markerCluster = new MarkerClusterer(map, [], {
            styles: [{
                url: "/m1.png",
                height: 53,
                width: 52,
                textColor: '#ffffff',
                textSize: 15
            }]
        });

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(function(position) {
                const pos = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };

                map.setCenter(pos);
            }, function() {
                handleLocationError(true, map.getCenter());
            });
        } else {
            handleLocationError(false, map.getCenter());
        }
    }

    function handleLocationError(browserHasGeolocation, pos) {
        console.log(browserHasGeolocation ?
            'Error: The Geolocation service failed.' :
            'Error: Your browser doesn\'t support geolocation.');
        map.setCenter(pos);
    }

    function geocodeLocation(userInput, maxRetries = 3) {
        return new Promise((resolve, reject) => {
            const attemptGeocode = (attempt = 1) => {
                geocoder.geocode({'address': userInput}, function(results, status) {
                    if (status === 'OK') {
                        resolve({location: results[0].geometry.location, userInput});
                    } else if (attempt < maxRetries) {
                        setTimeout(() => attemptGeocode(attempt + 1), 1000);
                    } else {
                        reject('Geocode was not successful for the following reason: ' + status);
                    }
                });
            };

            attemptGeocode();
        });
    }

    function downloadData(format) {
        const data = markers.map(marker => ({
            userInput: marker.userInput,
            lat: marker.getPosition().lat(),
            lng: marker.getPosition().lng()
        }));

        let text;
        if (format === 'json') {
            text = JSON.stringify(data);
        } else if (format === 'csv') {
            const rows = data.map(marker => `${marker.userInput},${marker.lat},${marker.lng}`);
            text = '"userInput","lat","lng"\n' + rows.join('\n');
        }

        const blob = new Blob([text], {type: 'text/plain'});
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `map_data.${format}`;
        link.click();

        URL.revokeObjectURL(url);
    }

    function populateResultsTable() {
        const resultsTableBody = document.getElementById('resultsTableBody');

        resultsTableBody.innerHTML = '';

        markers.forEach(marker => {
            const row = document.createElement('tr');

            const userInputCell = document.createElement('td');
            userInputCell.textContent = marker.userInput;
            row.appendChild(userInputCell);

            const latCell = document.createElement('td');
            latCell.textContent = marker.getPosition().lat();
            row.appendChild(latCell);

            const lngCell = document.createElement('td');
            lngCell.textContent = marker.getPosition().lng();
            row.appendChild(lngCell);

            resultsTableBody.appendChild(row);
        });
    }

    function clearResults() {
        if (confirm('Are you sure you want to clear all results? This action cannot be undone.')) {
            markers.forEach(marker => {
                marker.setMap(null);
            });
            markers = [];
            markerCluster.clearMarkers();
            const resultOptions = document.querySelectorAll('.result-option');
            resultOptions.forEach(option => option.classList.add('disabled'));
            const resultsTableBody = document.getElementById('resultsTableBody');
            resultsTableBody.innerHTML = '';
            const progressBar = document.getElementById('progressBar');
            progressBar.style.width = '0%';
            progressBar.setAttribute('aria-valuenow', 0);
        }
    }

    function tableToString() {
        const rows = Array.from(document.querySelectorAll('#resultsTableBody tr'));
        return rows.map(row => {
            return Array.from(row.querySelectorAll('td')).map(cell => cell.textContent).join('\t');
        }).join('\n');
    }

    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(function() {
            console.log('Copying to clipboard was successful!');
        }, function(err) {
            console.error('Could not copy text: ', err);
        });
    }

    window.onload = function() {
        const resultOptions = document.querySelectorAll('.result-option');
        resultOptions.forEach(option => option.classList.add('disabled'));

        initMap();

        document.getElementById('mapType').addEventListener('change', function() {
            map.setMapTypeId(this.value);
        });

        document.getElementById('submitLocations').addEventListener('click', function() {
            const locationInput = document.getElementById('locationInput');
            const locations = locationInput.value.split('\n');
            const progressBar = document.getElementById('progressBar');
            const enableMarkerCluster = document.getElementById('markerCluster').checked;

            progressBar.style.width = '0%';
            progressBar.setAttribute('aria-valuenow', 0);

            let delay = 0;
            locations.forEach((userInput, index) => {
                setTimeout(() => {
                    geocodeLocation(userInput)
                        .then(result => {
                            const marker = new google.maps.Marker({
                                position: result.location,
                                icon: {
                                    url: `http://maps.google.com/mapfiles/ms/icons/${markerColor}-dot.png`
                                },
                                userInput: result.userInput
                            });

                            const infowindow = new google.maps.InfoWindow({
                                content: `<p><b>${result.userInput}</b></p><p>Latitude: ${result.location.lat()}</p><p>Longitude: ${result.location.lng()}</p>`
                            });

                            marker.addListener('click', function() {
                                infowindow.open(map, marker);
                            });

                            markers.push(marker);
                            if (enableMarkerCluster) {
                                markerCluster.addMarker(marker, false);
                            } else {
                                marker.setMap(map);
                            }

                            bounds.extend(marker.position);
                            map.fitBounds(bounds);

                            const progress = Math.round((index + 1) / locations.length * 100);
                            progressBar.style.width = progress + '%';
                            progressBar.setAttribute('aria-valuenow', progress);

                            if (index === locations.length - 1) {
                                populateResultsTable();
                                const confetti = window.confetti;
                                confetti({
                                    particleCount: 100,
                                    spread: 70,
                                    origin: { y: 0.6 }
                                });

                                resultOptions.forEach(option => option.classList.remove('disabled'));

                                setTimeout(function() {
                                    const resultsModal = new bootstrap.Modal(document.getElementById('resultsModal'));
                                    resultsModal.show();
                                }, 3000);
                            }
                        })
                        .catch(error => console.error(error));
                }, delay);

                delay += 500;
            });

            markerCluster.redraw();
            locationInput.value = '';
            $('#locationModal').modal('hide');
        });

        document.getElementById('downloadJson').addEventListener('click', function() {
            downloadData('json');
        });

        document.getElementById('downloadCsv').addEventListener('click', function() {
            downloadData('csv');
        });

        document.getElementById('viewResults').addEventListener('click', populateResultsTable);

        document.getElementById('submitLocations').addEventListener('click', function() {
            const mapType = document.getElementById('mapType').value;
            markerColor = document.getElementById('markerColor').value;

            map.setMapTypeId(mapType);

            $('#settingsModal').modal('hide');
        });

        document.getElementById('downloadJsonModal').addEventListener('click', function() {
            downloadData('json');
        });

        document.getElementById('downloadCsvModal').addEventListener('click', function() {
            downloadData('csv');
        });

        document.getElementById('clearResults').addEventListener('click', clearResults);

        document.getElementById('clearResultsModal').addEventListener('click', clearResults);

        document.getElementById('copyClipboard').addEventListener('click', function() {
            copyToClipboard(tableToString());
            this.textContent = 'Copied to clipboard';
            setTimeout(() => this.textContent = 'Copy to Clipboard', 3000);
        });

        document.getElementById('copyClipboardModal').addEventListener('click', function() {
            copyToClipboard(tableToString());
            this.textContent = 'Copied to clipboard';
            setTimeout(() => this.textContent = 'Copy to Clipboard', 3000);
        });
    };
})();
