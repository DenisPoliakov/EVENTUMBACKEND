class TeamSummary {
  final String id;
  final String name;
  final String city;
  final String captainUserId;
  final TeamUser captain;
  final List<TeamMemberItem> members;
  final List<TeamInvitationItem> invitations;

  const TeamSummary({
    required this.id,
    required this.name,
    required this.city,
    required this.captainUserId,
    required this.captain,
    required this.members,
    required this.invitations,
  });

  factory TeamSummary.fromJson(Map<String, dynamic> json) {
    return TeamSummary(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      city: json['city']?.toString() ?? '',
      captainUserId: json['captainUserId']?.toString() ?? '',
      captain: TeamUser.fromJson(
        (json['captain'] as Map<String, dynamic>?) ?? const {},
      ),
      members: ((json['members'] as List?) ?? const [])
          .map((item) => TeamMemberItem.fromJson(item as Map<String, dynamic>))
          .toList(),
      invitations: ((json['invitations'] as List?) ?? const [])
          .map((item) =>
              TeamInvitationItem.fromJson(item as Map<String, dynamic>))
          .toList(),
    );
  }
}

class TeamUser {
  final String id;
  final String username;
  final String firstName;
  final String lastName;
  final String email;

  const TeamUser({
    required this.id,
    required this.username,
    required this.firstName,
    required this.lastName,
    required this.email,
  });

  String get displayName {
    final full = '$firstName $lastName'.trim();
    return full.isNotEmpty ? full : username;
  }

  factory TeamUser.fromJson(Map<String, dynamic> json) {
    return TeamUser(
      id: json['id']?.toString() ?? '',
      username: json['username']?.toString() ?? '',
      firstName: json['firstName']?.toString() ?? '',
      lastName: json['lastName']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
    );
  }
}

class TeamMemberItem {
  final String id;
  final String userId;
  final String role;
  final String fieldPosition;
  final TeamUser user;

  const TeamMemberItem({
    required this.id,
    required this.userId,
    required this.role,
    required this.fieldPosition,
    required this.user,
  });

  factory TeamMemberItem.fromJson(Map<String, dynamic> json) {
    return TeamMemberItem(
      id: json['id']?.toString() ?? '',
      userId: json['userId']?.toString() ?? '',
      role: json['role']?.toString() ?? 'MEMBER',
      fieldPosition: json['fieldPosition']?.toString() ?? '',
      user: TeamUser.fromJson(
        (json['user'] as Map<String, dynamic>?) ?? const {},
      ),
    );
  }
}

class TeamInvitationItem {
  final String id;
  final String status;
  final String inviteeIdentifier;
  final String createdAt;
  final String respondedAt;
  final TeamSummaryLite? team;
  final TeamUser? inviter;
  final TeamUser? invitee;

  const TeamInvitationItem({
    required this.id,
    required this.status,
    required this.inviteeIdentifier,
    required this.createdAt,
    required this.respondedAt,
    this.team,
    this.inviter,
    this.invitee,
  });

  factory TeamInvitationItem.fromJson(Map<String, dynamic> json) {
    return TeamInvitationItem(
      id: json['id']?.toString() ?? '',
      status: json['status']?.toString() ?? 'PENDING',
      inviteeIdentifier: json['inviteeIdentifier']?.toString() ?? '',
      createdAt: json['createdAt']?.toString() ?? '',
      respondedAt: json['respondedAt']?.toString() ?? '',
      team: json['team'] is Map<String, dynamic>
          ? TeamSummaryLite.fromJson(json['team'] as Map<String, dynamic>)
          : null,
      inviter: json['inviter'] is Map<String, dynamic>
          ? TeamUser.fromJson(json['inviter'] as Map<String, dynamic>)
          : null,
      invitee: json['invitee'] is Map<String, dynamic>
          ? TeamUser.fromJson(json['invitee'] as Map<String, dynamic>)
          : null,
    );
  }
}

class TeamSummaryLite {
  final String id;
  final String name;
  final String city;
  final TeamUser captain;
  final int memberCount;

  const TeamSummaryLite({
    required this.id,
    required this.name,
    required this.city,
    required this.captain,
    this.memberCount = 0,
  });

  factory TeamSummaryLite.fromJson(Map<String, dynamic> json) {
    return TeamSummaryLite(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      city: json['city']?.toString() ?? '',
      captain: TeamUser.fromJson(
        (json['captain'] as Map<String, dynamic>?) ?? const {},
      ),
      memberCount: int.tryParse(json['memberCount']?.toString() ?? '') ?? 0,
    );
  }
}
