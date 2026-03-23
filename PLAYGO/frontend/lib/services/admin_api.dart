import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:playgo/models/player_card.dart';

class Stadium {
  final String id;
  final String name;
  final String address;
  final String imageUrl;
  final double lat;
  final double lon;
  final String? cityId;

  Stadium({
    required this.id,
    required this.name,
    required this.address,
    required this.imageUrl,
    required this.lat,
    required this.lon,
    this.cityId,
  });

  factory Stadium.fromJson(Map<String, dynamic> json) => Stadium(
        id: json['id'].toString(),
        name: json['name'] ?? '',
        address: json['address'] ?? '',
        imageUrl: (json['image'] ??
            json['imageUrl'] ??
            json['photo'] ??
            json['logo'] ??
            '') as String,
        lat: _toDouble(json['lat'] ?? json['latitude']),
        lon: _toDouble(json['lon'] ?? json['longitude']),
        cityId: json['cityId']?.toString(),
      );
}

class MatchItem {
  final String id;
  final String title;
  final String startsAt;
  final String endsAt;
  final String price;
  final int priceCents;
  final String currency;
  final String status;
  final String format;
  final String fieldType;
  final String teamSize;
  final int maxTeams;
  final int registeredTeams;
  final int approvedTeams;
  final bool hasOwnApproved;
  final String? stadiumId;

  MatchItem({
    required this.id,
    required this.title,
    required this.startsAt,
    required this.endsAt,
    required this.price,
    required this.priceCents,
    required this.currency,
    required this.status,
    required this.format,
    required this.fieldType,
    required this.teamSize,
    required this.maxTeams,
    required this.registeredTeams,
    required this.approvedTeams,
    required this.hasOwnApproved,
    this.stadiumId,
  });

  factory MatchItem.fromJson(Map<String, dynamic> json) => MatchItem(
        id: json['id'].toString(),
        title: json['title'] ?? '',
        startsAt: json['startsAt'] ??
            json['startAt'] ??
            json['startTime'] ??
            json['date'] ??
            '',
        endsAt: json['endsAt'] ?? json['endAt'] ?? json['endTime'] ?? '',
        price: (json['price'] ??
                json['teamPrice'] ??
                json['entryPrice'] ??
                json['fee'] ??
                '')
            .toString(),
        priceCents: _toInt(
            json['priceCents'] ?? json['feeCents'] ?? json['teamPriceCents']),
        currency: (json['currency'] ?? 'RUB').toString(),
        status: json['status'] ?? '',
        format: json['format']?.toString() ?? json['mode']?.toString() ?? '',
        fieldType:
            json['fieldType']?.toString() ?? json['field']?.toString() ?? '',
        teamSize:
            json['teamSize']?.toString() ?? json['players']?.toString() ?? '',
        maxTeams: _toInt(
            json['maxTeams'] ?? json['teamsLimit'] ?? json['maxTeamsCount']),
        registeredTeams: _toInt(json['registeredTeams'] ??
            json['teamsRegistered'] ??
            json['applicationsCount']),
        approvedTeams: _extractApproved(json),
        hasOwnApproved: false,
        stadiumId: json['stadiumId']?.toString(),
      );
}

int _extractApproved(Map<String, dynamic> json) {
  // prefer explicit field if backend provides it
  final direct = json['acceptedCount'] ?? json['approvedCount'];
  final directInt = _toInt(direct);
  if (directInt > 0) return directInt;

  // otherwise, try to infer from registrations array
  final regs = json['registrations'];
  if (regs is List) {
    return regs.where((e) {
      if (e is Map && e['status'] != null) {
        return e['status'].toString().toUpperCase() == 'APPROVED';
      }
      return false;
    }).length;
  }
  return 0;
}

int _toInt(dynamic v) {
  if (v is int) return v;
  if (v is num) return v.toInt();
  return int.tryParse(v?.toString() ?? '') ?? 0;
}

double _toDouble(dynamic v) {
  if (v is num) return v.toDouble();
  return double.tryParse(v?.toString() ?? '') ?? 0;
}

// extension-like copy
extension MatchItemCopy on MatchItem {
  MatchItem copyWith({
    String? id,
    String? title,
    String? startsAt,
    String? endsAt,
    String? price,
    int? priceCents,
    String? currency,
    String? status,
    String? format,
    String? fieldType,
    String? teamSize,
    int? maxTeams,
    int? registeredTeams,
    int? approvedTeams,
    bool? hasOwnApproved,
    String? stadiumId,
  }) {
    return MatchItem(
      id: id ?? this.id,
      title: title ?? this.title,
      startsAt: startsAt ?? this.startsAt,
      endsAt: endsAt ?? this.endsAt,
      price: price ?? this.price,
      priceCents: priceCents ?? this.priceCents,
      currency: currency ?? this.currency,
      status: status ?? this.status,
      format: format ?? this.format,
      fieldType: fieldType ?? this.fieldType,
      teamSize: teamSize ?? this.teamSize,
      maxTeams: maxTeams ?? this.maxTeams,
      registeredTeams: registeredTeams ?? this.registeredTeams,
      approvedTeams: approvedTeams ?? this.approvedTeams,
      hasOwnApproved: hasOwnApproved ?? this.hasOwnApproved,
      stadiumId: stadiumId ?? this.stadiumId,
    );
  }
}

class AdminApi {
  AdminApi({http.Client? client})
      : _client = client ?? http.Client(),
        baseUrl = const String.fromEnvironment('ADMIN_API_BASE',
            defaultValue: 'http://localhost:4000');

  final http.Client _client;
  final String baseUrl;
  static const Duration _timeout = Duration(seconds: 10);

  String? get _basicHeader {
    const user = String.fromEnvironment('ADMIN_BASIC_USER', defaultValue: '');
    const pass = String.fromEnvironment('ADMIN_BASIC_PASS', defaultValue: '');
    if (user.isEmpty && pass.isEmpty) return null;
    final creds = base64Encode(utf8.encode('$user:$pass'));
    return 'Basic $creds';
  }

  Map<String, String> _headers() {
    final h = <String, String>{'Content-Type': 'application/json'};
    final auth = _basicHeader;
    if (auth != null) h['Authorization'] = auth;
    return h;
  }

  Future<List<Stadium>> fetchStadiums(String cityId) async {
    final uri = Uri.parse('$baseUrl/api/stadiums').replace(queryParameters: {
      'cityId': cityId,
      'city': cityId, // на случай если бэкенд ждёт другое имя параметра
    });
    final res = await _client.get(uri, headers: _headers()).timeout(_timeout);
    try {
      final data = _decode(res);
      if (data is List && data.isNotEmpty) {
        return data
            .map((e) => Stadium.fromJson(e as Map<String, dynamic>))
            .toList();
      }
    } catch (_) {
      rethrow;
    }

    // fallback без фильтра города, если ничего не вернулось
    final resAll = await _client
        .get(
          Uri.parse('$baseUrl/api/stadiums'),
          headers: _headers(),
        )
        .timeout(_timeout);
    final dataAll = _decode(resAll);
    if (dataAll is List) {
      return dataAll
          .map((e) => Stadium.fromJson(e as Map<String, dynamic>))
          .toList();
    }
    return [];
  }

  Future<List<MatchItem>> fetchMatches(String stadiumId) async {
    final uri = Uri.parse('$baseUrl/api/matches')
        .replace(queryParameters: {'stadiumId': stadiumId, 'status': 'OPEN'});
    final res = await _client.get(uri, headers: _headers()).timeout(_timeout);
    final data = _decode(res);
    if (data is List) {
      return data
          .map((e) => MatchItem.fromJson(e as Map<String, dynamic>))
          .toList();
    }
    return [];
  }

  Future<MatchItem?> fetchMatchById(String id) async {
    final uri = Uri.parse('$baseUrl/api/matches/$id');
    final res = await _client.get(uri, headers: _headers()).timeout(_timeout);
    final data = _decode(res);
    if (data is Map<String, dynamic>) {
      return MatchItem.fromJson(data);
    }
    return null;
  }

  Future<List<Registration>> fetchRegistrations(
      {String? captainLogin,
      String? teamId,
      String? status,
      String? matchId}) async {
    final uri = Uri.parse('$baseUrl/api/registrations').replace(
      queryParameters: {
        if (captainLogin != null && captainLogin.isNotEmpty)
          'captainLogin': captainLogin,
        if (teamId != null && teamId.isNotEmpty) 'teamId': teamId,
        if (status != null && status.isNotEmpty) 'status': status,
        if (matchId != null && matchId.isNotEmpty) 'matchId': matchId,
      },
    );
    final res = await _client.get(uri, headers: _headers()).timeout(_timeout);
    final data = _decode(res);
    if (data is List) {
      return data
          .map((e) => Registration.fromJson(e as Map<String, dynamic>))
          .toList();
    }
    return [];
  }

  Future<void> register({
    required String matchId,
    required String teamName,
    required String captainName,
    required String captainLogin,
    String? teamId,
    String? note,
    int? participants,
  }) async {
    final uri = Uri.parse('$baseUrl/api/registrations');
    final res = await _client
        .post(uri,
            headers: _headers(),
            body: jsonEncode({
              'matchId': matchId,
              'teamName': teamName,
              'captainName': captainName,
              'captainLogin': captainLogin,
              if (teamId != null && teamId.isNotEmpty) 'teamId': teamId,
              if (note != null && note.isNotEmpty) 'note': note,
              if (participants != null && participants > 0)
                'playersCount': participants,
            }))
        .timeout(_timeout);
    _decode(res); // throw on error
  }

  Future<List<PlayerCard>> fetchPlayers({
    String? city,
    String? position,
    String? skill,
    int? minRating,
    bool lookingForTeam = false,
    String? q,
  }) async {
    final uri = Uri.parse('$baseUrl/api/players').replace(queryParameters: {
      if (city != null && city.isNotEmpty) 'city': city,
      if (position != null && position.isNotEmpty) 'position': position,
      if (skill != null && skill.isNotEmpty) 'skill': skill,
      if (minRating != null) 'minRating': minRating.toString(),
      if (lookingForTeam) 'lookingForTeam': 'true',
      if (q != null && q.isNotEmpty) 'q': q,
    });
    final res = await _client.get(uri, headers: _headers()).timeout(_timeout);
    final data = _decode(res);
    if (data is List) {
      return data
          .map((item) => PlayerCard.fromJson(item as Map<String, dynamic>))
          .toList();
    }
    return [];
  }

  Future<PlayerCard?> fetchPlayerByUserId(String userId) async {
    final uri = Uri.parse('$baseUrl/api/players/$userId');
    final res = await _client.get(uri, headers: _headers()).timeout(_timeout);
    final data = _decode(res);
    if (data is Map<String, dynamic>) {
      return PlayerCard.fromJson(data);
    }
    return null;
  }

  dynamic _decode(http.Response res) {
    final code = res.statusCode;
    dynamic body;
    try {
      body = jsonDecode(res.body);
    } catch (_) {
      body = res.body;
    }
    if (code >= 200 && code < 300) return body;
    final msg = (body is Map && body['message'] != null)
        ? body['message'].toString()
        : res.reasonPhrase ?? 'API error';
    throw Exception('API $code: $msg');
  }
}

class Registration {
  final String id;
  final String matchId;
  final String teamId;
  final String teamName;
  final String captainName;
  final String captainLogin;
  final String status;
  final DateTime? updatedAt;

  Registration({
    required this.id,
    required this.matchId,
    required this.teamId,
    required this.teamName,
    required this.captainName,
    required this.captainLogin,
    required this.status,
    this.updatedAt,
  });

  factory Registration.fromJson(Map<String, dynamic> json) => Registration(
        id: json['id']?.toString() ?? '',
        matchId: json['matchId']?.toString() ?? '',
        teamId: json['teamId']?.toString() ?? '',
        teamName: json['teamName']?.toString() ?? '',
        captainName: json['captainName']?.toString() ?? '',
        captainLogin: json['captainLogin']?.toString() ?? '',
        status: json['status']?.toString() ?? '',
        updatedAt:
            _parseDate(json['updatedAt']) ?? _parseDate(json['createdAt']),
      );
}

DateTime? _parseDate(dynamic v) {
  if (v == null) return null;
  try {
    return DateTime.parse(v.toString());
  } catch (_) {
    return null;
  }
}
