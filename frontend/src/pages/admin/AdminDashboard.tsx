import { useEffect, useState } from 'react';
import { Alert, Card, Col, Row, Spinner } from 'react-bootstrap';
import { adminApi } from '../../api/admin.api';
import { DashboardStats } from '../../types/admin.types';

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi.stats().then(setStats).catch(() => setError('Unable to load dashboard statistics.'));
  }, []);

  if (error) return <Alert variant="danger">{error}</Alert>;
  if (!stats) return <div className="text-center my-4"><Spinner animation="border" /></div>;

  const cards = [
    { label: 'Total users', value: stats.users },
    { label: 'Total posts', value: stats.posts },
    { label: 'Total comments', value: stats.comments },
  ];
  return (
    <Row className="g-3">
      {cards.map((card) => (
        <Col key={card.label} sm={6} lg={4}>
          <Card className="h-100">
            <Card.Body>
              <Card.Subtitle className="hn-muted mb-2">{card.label}</Card.Subtitle>
              <div className="hn-stat-value" data-testid={card.label}>{card.value}</div>
            </Card.Body>
          </Card>
        </Col>
      ))}
    </Row>
  );
}
