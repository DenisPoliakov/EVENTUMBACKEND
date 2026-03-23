import 'dart:convert';
import 'package:flutter/services.dart' show rootBundle;

class CityData {
  final String name;
  final double lat;
  final double lon;
  CityData({required this.name, required this.lat, required this.lon});
}

class CityRepository {
  CityRepository._();
  static final CityRepository _instance = CityRepository._();
  static CityRepository get instance => _instance;

  Future<List<String>> load() async {
    final cities = await _loadCities();
    return cities.map((c) => c.name).toList();
  }

  Future<List<CityData>> loadCities() => _loadCities();

  Future<CityData?> findCity(String name) async {
    final cities = await _loadCities();
    final n = name.trim().toLowerCase();
    for (final c in cities) {
      if (c.name.toLowerCase() == n) return c;
    }
    return null;
  }

  List<CityData>? _cache;

  Future<List<CityData>> _loadCities() async {
    if (_cache != null) return _cache!;
    final raw = await rootBundle.loadString('assets/ussian-cities.jso');
    final List<dynamic> jsonList = jsonDecode(raw);
    _cache = jsonList
        .map((e) => CityData(
              name: (e['name'] as String?) ?? '',
              lat: double.tryParse(e['coords']?['lat']?.toString() ?? '') ?? 0,
              lon: double.tryParse(e['coords']?['lon']?.toString() ?? '') ?? 0,
            ))
        .where((c) => c.name.isNotEmpty)
        .toList();
    return _cache!;
  }
}
