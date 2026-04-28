import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:playgo/services/admin_api.dart';

class NewsScreen extends StatefulWidget {
  const NewsScreen({super.key, required this.api});

  final AdminApi api;

  @override
  State<NewsScreen> createState() => _NewsScreenState();
}

class _NewsScreenState extends State<NewsScreen> {
  late Future<List<NewsItem>> _future;

  @override
  void initState() {
    super.initState();
    _future = widget.api.fetchNews();
  }

  Future<void> _reload() async {
    setState(() {
      _future = widget.api.fetchNews();
    });
    await _future;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Новости')),
      body: RefreshIndicator(
        onRefresh: _reload,
        child: FutureBuilder<List<NewsItem>>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snap.hasError) {
              return ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: [
                  Padding(
                    padding: const EdgeInsets.all(20),
                    child: Text('Не удалось загрузить новости: ${snap.error}'),
                  ),
                ],
              );
            }
            final news = snap.data ?? [];
            if (news.isEmpty) {
              return ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: const [
                  Padding(
                    padding: EdgeInsets.all(20),
                    child: Text('Пока новостей нет'),
                  ),
                ],
              );
            }
            return ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              itemCount: news.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (_, i) => _NewsCard(item: news[i]),
            );
          },
        ),
      ),
    );
  }
}

class _NewsCard extends StatelessWidget {
  const _NewsCard({required this.item});

  final NewsItem item;

  @override
  Widget build(BuildContext context) {
    final published = item.publishedAt == null
        ? ''
        : DateFormat('dd.MM.yyyy HH:mm').format(item.publishedAt!.toLocal());

    return Card(
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (item.imageUrl.isNotEmpty)
            Image.network(
              item.imageUrl,
              height: 180,
              width: double.infinity,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => const SizedBox.shrink(),
            ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (published.isNotEmpty)
                  Text(
                    published,
                    style: const TextStyle(
                      color: Colors.black54,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                if (published.isNotEmpty) const SizedBox(height: 8),
                Text(
                  item.title,
                  style: Theme.of(context)
                      .textTheme
                      .titleMedium
                      ?.copyWith(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 8),
                Text(item.body),
                if (item.stadiumName.isNotEmpty || item.cityName.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Text(
                    [
                      if (item.stadiumName.isNotEmpty) item.stadiumName,
                      if (item.cityName.isNotEmpty) item.cityName,
                    ].join(' • '),
                    style: const TextStyle(
                      color: Colors.black54,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
