import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:playgo/models/player_card.dart';
import 'package:playgo/models/team_models.dart';

class ApiClient {
  ApiClient({http.Client? client})
      : _client = client ?? http.Client(),
        baseUrl = const String.fromEnvironment(
          'API_BASE',
          defaultValue: 'http://localhost:4000',
        );

  final http.Client _client;
  final String baseUrl;

  Future<Map<String, dynamic>> register({
    required String email,
    required String username,
    required String password,
    required String firstName,
    required String lastName,
    required String city,
  }) async {
    final res = await _client.post(
      Uri.parse('$baseUrl/api/auth/register'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'email': email,
        'username': username,
        'password': password,
        'firstName': firstName,
        'lastName': lastName,
        'city': city,
      }),
    );
    return _decode(res);
  }

  Future<Map<String, dynamic>> login({
    required String identifier,
    required String password,
  }) async {
    final res = await _client.post(
      Uri.parse('$baseUrl/api/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'identifier': identifier,
        'password': password,
      }),
    );
    return _decode(res);
  }

  Future<Map<String, dynamic>> me(String token) async {
    final res = await _client.get(
      Uri.parse('$baseUrl/api/me'),
      headers: {'Authorization': 'Bearer $token'},
    );
    return _decode(res);
  }

  Future<PlayerCard?> myPlayerCard(String token) async {
    final res = await _client.get(
      Uri.parse('$baseUrl/api/me/player-card'),
      headers: {'Authorization': 'Bearer $token'},
    );
    final body = _decode(res);
    final json = body['playerCard'];
    if (json is Map<String, dynamic>) {
      return PlayerCard.fromJson(json);
    }
    return null;
  }

  Future<PlayerCardOptions> playerCardOptions() async {
    final res =
        await _client.get(Uri.parse('$baseUrl/api/player-card-options'));
    final body = _decode(res);
    return PlayerCardOptions.fromJson(body);
  }

  Future<PlayerCard> saveMyPlayerCard({
    required String token,
    required Map<String, dynamic> payload,
  }) async {
    final res = await _client.put(
      Uri.parse('$baseUrl/api/me/player-card'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: jsonEncode(payload),
    );
    final body = _decode(res);
    return PlayerCard.fromJson(body['playerCard'] as Map<String, dynamic>);
  }

  Future<String> uploadPlayerAvatar({
    required String token,
    required File file,
  }) async {
    final req = http.MultipartRequest(
      'POST',
      Uri.parse('$baseUrl/api/me/player-card/avatar'),
    );
    req.headers['Authorization'] = 'Bearer $token';
    req.files.add(await http.MultipartFile.fromPath('file', file.path));
    final stream = await req.send();
    final res = await http.Response.fromStream(stream);
    final body = _decode(res);
    return body['url']?.toString() ?? '';
  }

  Future<TeamSummary?> myTeam(String token) async {
    final res = await _client.get(
      Uri.parse('$baseUrl/api/me/team'),
      headers: {'Authorization': 'Bearer $token'},
    );
    final body = _decode(res);
    final json = body['team'];
    if (json is Map<String, dynamic>) {
      return TeamSummary.fromJson(json);
    }
    return null;
  }

  Future<TeamSummary> createTeam({
    required String token,
    required String name,
  }) async {
    final res = await _client.post(
      Uri.parse('$baseUrl/api/me/team'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({'name': name}),
    );
    final body = _decode(res);
    return TeamSummary.fromJson(body['team'] as Map<String, dynamic>);
  }

  Future<TeamInvitationItem> inviteToTeam({
    required String token,
    required String teamId,
    required String identifier,
  }) async {
    final res = await _client.post(
      Uri.parse('$baseUrl/api/me/team/invitations'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'teamId': teamId,
        'identifier': identifier,
      }),
    );
    final body = _decode(res);
    return TeamInvitationItem.fromJson(
      body['invitation'] as Map<String, dynamic>,
    );
  }

  Future<List<TeamInvitationItem>> myTeamInvitations(String token) async {
    final res = await _client.get(
      Uri.parse('$baseUrl/api/me/team-invitations'),
      headers: {'Authorization': 'Bearer $token'},
    );
    final body = _decode(res);
    return ((body['invitations'] as List?) ?? const [])
        .map(
            (item) => TeamInvitationItem.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<TeamSummary> acceptTeamInvitation({
    required String token,
    required String invitationId,
  }) async {
    final res = await _client.post(
      Uri.parse('$baseUrl/api/me/team-invitations/$invitationId/accept'),
      headers: {'Authorization': 'Bearer $token'},
    );
    final body = _decode(res);
    return TeamSummary.fromJson(body['team'] as Map<String, dynamic>);
  }

  Future<void> rejectTeamInvitation({
    required String token,
    required String invitationId,
  }) async {
    final res = await _client.post(
      Uri.parse('$baseUrl/api/me/team-invitations/$invitationId/reject'),
      headers: {'Authorization': 'Bearer $token'},
    );
    _decode(res);
  }

  Future<TeamMemberItem> updateTeamMemberRole({
    required String token,
    required String memberId,
    required String role,
    required String fieldPosition,
  }) async {
    final res = await _client.patch(
      Uri.parse('$baseUrl/api/me/team/members/$memberId'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'role': role,
        'fieldPosition': fieldPosition,
      }),
    );
    final body = _decode(res);
    return TeamMemberItem.fromJson(body['member'] as Map<String, dynamic>);
  }

  Future<TeamSummary> fetchPublicTeam(String teamId) async {
    final res =
        await _client.get(Uri.parse('$baseUrl/api/teams/$teamId/public'));
    final body = _decode(res);
    return TeamSummary.fromJson(body['team'] as Map<String, dynamic>);
  }

  Future<Map<String, dynamic>> updateProfile({
    required String token,
    required String email,
    required String firstName,
    required String lastName,
    required String city,
  }) async {
    final res = await _client.patch(
      Uri.parse('$baseUrl/api/me'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'email': email,
        'firstName': firstName,
        'lastName': lastName,
        'city': city,
      }),
    );
    return _decode(res);
  }

  Future<Map<String, dynamic>> changePassword({
    required String token,
    required String oldPassword,
    required String newPassword,
  }) async {
    final res = await _client.post(
      Uri.parse('$baseUrl/api/me/password'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'oldPassword': oldPassword,
        'newPassword': newPassword,
      }),
    );
    return _decode(res);
  }

  Future<void> checkPassword({
    required String token,
    required String password,
  }) async {
    final res = await _client.post(
      Uri.parse('$baseUrl/api/me/password/check'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({'password': password}),
    );
    _decode(res);
  }

  Map<String, dynamic> _decode(http.Response res) {
    final code = res.statusCode;
    Map<String, dynamic> body;
    try {
      body = jsonDecode(res.body) as Map<String, dynamic>;
    } catch (_) {
      body = {'error': res.body};
    }
    if (code >= 200 && code < 300) return body;
    final message = body['message'] ?? body['error'] ?? 'Unknown error';
    throw ApiException(code, message.toString());
  }
}

class ApiException implements Exception {
  ApiException(this.code, this.message);
  final int code;
  final String message;

  @override
  String toString() => 'ApiException($code): $message';
}
