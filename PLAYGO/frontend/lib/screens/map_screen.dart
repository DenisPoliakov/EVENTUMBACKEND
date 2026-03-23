import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:playgo/models/user.dart';
import 'package:playgo/services/admin_api.dart';
import 'package:playgo/services/city_repository.dart';

class MapScreen extends StatefulWidget {
  const MapScreen({super.key, required this.user});
  final User user;

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  final _api = AdminApi();
  late Future<_MapData> _dataFuture;
  final MapController _mapController = MapController();
  LatLng? _lastCenter;

  @override
  void initState() {
    super.initState();
    _dataFuture = _load();
  }

  @override
  void didUpdateWidget(covariant MapScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.user.city != widget.user.city) {
      setState(() {
        _dataFuture = _load();
      });
    }
  }

  Future<_MapData> _load() async {
    final stadiums = await _api.fetchStadiums(widget.user.city);
    final center = stadiums.isNotEmpty
        ? LatLng(stadiums.first.lat, stadiums.first.lon)
        : await _resolveCenterByCity();
    return _MapData(center: center, stadiums: stadiums);
  }

  Future<LatLng> _resolveCenterByCity() async {
    final repo = CityRepository.instance;
    final city = await repo.findCity(widget.user.city);
    if (city != null && city.lat != 0 && city.lon != 0) {
      return LatLng(city.lat, city.lon);
    }
    // fallback: Москва
    return LatLng(55.7558, 37.6173);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Карта')),
      body: FutureBuilder<_MapData>(
        future: _dataFuture,
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.error_outline, size: 42),
                    const SizedBox(height: 12),
                    const Text(
                      'Не удалось загрузить стадионы',
                      style:
                          TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      snapshot.error.toString(),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 16),
                    ElevatedButton(
                      onPressed: () {
                        setState(() {
                          _dataFuture = _load();
                        });
                      },
                      child: const Text('Повторить'),
                    ),
                  ],
                ),
              ),
            );
          }
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          final data = snapshot.data!;
          final center = data.center;
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (_lastCenter == null ||
                _lastCenter!.latitude != center.latitude ||
                _lastCenter!.longitude != center.longitude) {
              _mapController.move(center, 11);
              _lastCenter = center;
            }
          });
          return FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: center,
              initialZoom: 11,
              maxZoom: 18,
              minZoom: 3,
            ),
            children: [
              TileLayer(
                urlTemplate:
                    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                subdomains: const ['a', 'b', 'c'],
                userAgentPackageName: 'playgo',
              ),
              MarkerLayer(
                markers: data.stadiums
                    .map((s) => Marker(
                          point: LatLng(s.lat, s.lon),
                          width: 140,
                          height: 60,
                          alignment: Alignment.topCenter,
                          child: _StadiumMarker(name: s.name),
                        ))
                    .toList(),
              )
            ],
          );
        },
      ),
    );
  }
}

class _MapData {
  final LatLng center;
  final List<Stadium> stadiums;
  _MapData({required this.center, required this.stadiums});
}

class _StadiumMarker extends StatelessWidget {
  const _StadiumMarker({required this.name});
  final String name;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(8),
            boxShadow: const [
              BoxShadow(
                  color: Color(0x22000000), blurRadius: 6, offset: Offset(0, 3))
            ],
          ),
          child: Text(
            name,
            textAlign: TextAlign.center,
            style: const TextStyle(
                fontWeight: FontWeight.w600, color: Colors.black87),
          ),
        ),
        const SizedBox(height: 4),
        const Icon(Icons.location_on, size: 28, color: Color(0xFF00C2C7)),
      ],
    );
  }
}
