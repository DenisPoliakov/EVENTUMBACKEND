import 'package:playgo/models/team_models.dart';

class PlayerCard {
  final String id;
  final String userId;
  final String city;
  final String username;
  final String firstName;
  final String lastName;
  final String position;
  final String preferredFoot;
  final int? heightCm;
  final int? weightKg;
  final int? age;
  final String favoriteFormat;
  final String bio;
  final String avatarUrl;
  final List<String> skillTags;
  final List<String> statuses;
  final int rating;
  final String createdAt;
  final String updatedAt;
  final TeamSummaryLite? currentTeam;

  const PlayerCard({
    required this.id,
    required this.userId,
    required this.city,
    required this.username,
    required this.firstName,
    required this.lastName,
    required this.position,
    required this.preferredFoot,
    required this.heightCm,
    required this.weightKg,
    required this.age,
    required this.favoriteFormat,
    required this.bio,
    required this.avatarUrl,
    required this.skillTags,
    required this.statuses,
    required this.rating,
    required this.createdAt,
    required this.updatedAt,
    required this.currentTeam,
  });

  String get displayName {
    final full = '$firstName $lastName'.trim();
    return full.isNotEmpty ? full : username;
  }

  factory PlayerCard.fromJson(Map<String, dynamic> json) {
    final user = (json['user'] as Map<String, dynamic>?) ?? const {};
    return PlayerCard(
      id: json['id']?.toString() ?? '',
      userId: json['userId']?.toString() ?? '',
      city: json['city']?.toString() ?? '',
      username: user['username']?.toString() ?? '',
      firstName: user['firstName']?.toString() ?? '',
      lastName: user['lastName']?.toString() ?? '',
      position: json['position']?.toString() ?? '',
      preferredFoot: json['preferredFoot']?.toString() ?? '',
      heightCm: _toInt(json['heightCm']),
      weightKg: _toInt(json['weightKg']),
      age: _toInt(json['age']),
      favoriteFormat: json['favoriteFormat']?.toString() ?? '',
      bio: json['bio']?.toString() ?? '',
      avatarUrl: json['avatarUrl']?.toString() ?? '',
      skillTags: _toStringList(json['skillTags']),
      statuses: _toStringList(json['statuses']),
      rating: _toInt(json['rating']) ?? 70,
      createdAt: json['createdAt']?.toString() ?? '',
      updatedAt: json['updatedAt']?.toString() ?? '',
      currentTeam: json['currentTeam'] is Map<String, dynamic>
          ? TeamSummaryLite.fromJson(
              json['currentTeam'] as Map<String, dynamic>)
          : null,
    );
  }
}

class PlayerCardOptions {
  final List<String> positions;
  final List<String> preferredFeet;
  final List<String> formats;
  final List<String> skillTags;
  final List<String> statuses;

  const PlayerCardOptions({
    required this.positions,
    required this.preferredFeet,
    required this.formats,
    required this.skillTags,
    required this.statuses,
  });

  factory PlayerCardOptions.fromJson(Map<String, dynamic> json) {
    return PlayerCardOptions(
      positions: _toStringList(json['positions']),
      preferredFeet: _toStringList(json['preferredFeet']),
      formats: _toStringList(json['formats']),
      skillTags: _toStringList(json['skillTags']),
      statuses: _toStringList(json['statuses']),
    );
  }
}

int? _toInt(dynamic value) {
  if (value == null) return null;
  if (value is int) return value;
  return int.tryParse(value.toString());
}

List<String> _toStringList(dynamic raw) {
  if (raw is! List) return const [];
  return raw.map((item) => item.toString()).toList();
}
