import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

const Color accentColor = Color(0xFF00C2C7);
const Color accentDark = Color(0xFF0095A0);
const Color lightBg = Color(0xFFF7F9FB);
const Color darkBg = Color(0xFF0F141A);
const double cardRadius = 16;

ThemeData lightTheme() {
  final base = ThemeData.light(useMaterial3: false);
  return base.copyWith(
    primaryColor: accentColor,
    scaffoldBackgroundColor: lightBg,
    colorScheme: base.colorScheme.copyWith(
      primary: accentColor,
      secondary: accentDark,
      surface: Colors.white,
      onPrimary: Colors.white,
    ),
    textTheme: GoogleFonts.manropeTextTheme(base.textTheme).apply(
      bodyColor: const Color(0xFF212121),
      displayColor: const Color(0xFF212121),
    ),
    appBarTheme: const AppBarTheme(
      elevation: 0,
      centerTitle: true,
      backgroundColor: accentColor,
      foregroundColor: Colors.white,
      titleTextStyle: TextStyle(
        fontSize: 20,
        fontWeight: FontWeight.w700,
        color: Colors.white,
      ),
    ),
    bottomNavigationBarTheme: const BottomNavigationBarThemeData(
      type: BottomNavigationBarType.fixed,
      selectedItemColor: accentColor,
      unselectedItemColor: Color(0xFF606C80),
      selectedLabelStyle: TextStyle(fontWeight: FontWeight.w600),
      unselectedLabelStyle: TextStyle(fontWeight: FontWeight.w500),
      showUnselectedLabels: true,
    ),
    cardTheme: CardThemeData(
      color: Colors.white,
      elevation: 4,
      shadowColor: Colors.black12,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(cardRadius),
      ),
    ),
  );
}

ThemeData darkTheme() {
  final base = ThemeData.dark(useMaterial3: false);
  return base.copyWith(
    primaryColor: accentColor,
    scaffoldBackgroundColor: darkBg,
    colorScheme: base.colorScheme.copyWith(
      primary: accentColor,
      secondary: accentDark,
      surface: const Color(0xFF1B2129),
      onPrimary: Colors.white,
    ),
    textTheme: GoogleFonts.manropeTextTheme(base.textTheme),
    appBarTheme: const AppBarTheme(
      centerTitle: true,
      elevation: 0,
      backgroundColor: accentDark,
      foregroundColor: Colors.white,
      titleTextStyle: TextStyle(
        fontSize: 20,
        fontWeight: FontWeight.w700,
        color: Colors.white,
      ),
    ),
    bottomNavigationBarTheme: const BottomNavigationBarThemeData(
      type: BottomNavigationBarType.fixed,
      selectedItemColor: accentColor,
      unselectedItemColor: Color(0xFF9BA5B5),
      selectedLabelStyle: TextStyle(fontWeight: FontWeight.w600),
      unselectedLabelStyle: TextStyle(fontWeight: FontWeight.w500),
      showUnselectedLabels: true,
    ),
    cardTheme: CardThemeData(
      color: const Color(0xFF1B2129),
      elevation: 2,
      shadowColor: Colors.black26,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(cardRadius),
      ),
    ),
  );
}
