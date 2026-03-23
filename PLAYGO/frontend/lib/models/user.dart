class User {
  final String id;
  final String email;
  final String username;
  final String firstName;
  final String lastName;
  final String city;
  final bool isBlocked;
  final String blockReason;
  final String blockedUntil;
  final String matchBanUntil;
  final bool hasPlayerCard;

  User({
    required this.id,
    required this.email,
    required this.username,
    required this.firstName,
    required this.lastName,
    required this.city,
    required this.isBlocked,
    required this.blockReason,
    required this.blockedUntil,
    required this.matchBanUntil,
    required this.hasPlayerCard,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] as String? ?? '',
      email: json['email'] as String? ?? '',
      username: json['username'] as String? ?? '',
      firstName: json['firstName'] as String? ?? '',
      lastName: json['lastName'] as String? ?? '',
      city: json['city'] as String? ?? '',
      isBlocked: json['isBlocked'] as bool? ?? false,
      blockReason: json['blockReason'] as String? ?? '',
      blockedUntil: json['blockedUntil'] as String? ?? '',
      matchBanUntil: json['matchBanUntil'] as String? ?? '',
      hasPlayerCard: json['hasPlayerCard'] as bool? ?? false,
    );
  }
}
