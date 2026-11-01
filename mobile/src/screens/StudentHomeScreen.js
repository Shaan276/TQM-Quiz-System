import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { quizApi } from '../services/api';

export default function StudentHomeScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pinInput, setPinInput] = useState('');

  const loadQuizzes = async () => {
    try {
      const res = await quizApi.getAvailableQuizzes();
      if (res.success && res.data?.quizzes) {
        setQuizzes(res.data.quizzes);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadQuizzes();
  }, []);

  const handleJoinLive = () => {
    if (!pinInput.trim()) {
      Alert.alert('PIN Required', 'Please enter a 6 or 8-character game PIN.');
      return;
    }
    navigation.navigate('LiveSession', { pin: pinInput.trim().toUpperCase() });
  };

  const handleStartQuiz = (quiz) => {
    navigation.navigate('QuizRunner', { quizId: quiz.id, quizTitle: quiz.title });
  };

  return (
    <View style={styles.container}>
      
      {/* Top App Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.userName}>{user?.name || 'Student'}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutBtnText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={quizzes}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadQuizzes(); }} tintColor="#10B981" />
        }
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            {/* Live PIN Quick Card */}
            <View style={styles.liveCard}>
              <View style={styles.liveHeaderRow}>
                <View style={styles.liveBadge}>
                  <Text style={styles.liveBadgeText}>LIVE BATTLE</Text>
                </View>
                <Text style={styles.liveSubtext}>Multiplayer Mode</Text>
              </View>

              <Text style={styles.liveTitle}>Join Live Classroom Quiz</Text>
              <Text style={styles.liveDesc}>
                Enter the session PIN from your instructor to compete in real-time.
              </Text>

              <View style={styles.pinRow}>
                <TextInput
                  style={styles.pinInput}
                  value={pinInput}
                  onChangeText={setPinInput}
                  placeholder="ENTER PIN (e.g. QUB99X)"
                  placeholderTextColor="#64748B"
                  autoCapitalize="characters"
                  maxLength={10}
                />
                <TouchableOpacity style={styles.joinBtn} onPress={handleJoinLive}>
                  <Text style={styles.joinBtnText}>Join</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Quizzes List Section Title */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Available Assessments</Text>
              <Text style={styles.sectionCount}>{quizzes.length} tests</Text>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.quizCard} 
            onPress={() => handleStartQuiz(item)}
            activeOpacity={0.75}
          >
            <View style={styles.quizCardHeader}>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryText}>{item.category || 'General'}</Text>
              </View>
              <Text style={styles.difficultyText}>{item.difficulty || 'Medium'}</Text>
            </View>

            <Text style={styles.quizTitle}>{item.title}</Text>
            <Text style={styles.quizDesc} numberOfLines={2}>
              {item.description || 'Test your knowledge on this subject.'}
            </Text>

            <View style={styles.quizFooter}>
              <Text style={styles.metaText}>
                ⏱ {Math.round((item.time_limit_sec || 600) / 60)} mins  •  Pass: {item.passing_percentage || 60}%
              </Text>
              <View style={styles.startPill}>
                <Text style={styles.startPillText}>Start Test →</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !loading && (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>No Assessments Available</Text>
              <Text style={styles.emptySubtitle}>Check back later or ask your instructor for an assignment.</Text>
            </View>
          )
        }
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070D18'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: '#0E1726',
    borderBottomWidth: 1,
    borderBottomColor: '#1E2E48'
  },
  greeting: {
    color: '#94A3B8',
    fontSize: 12
  },
  userName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900'
  },
  logoutBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderColor: 'rgba(244, 63, 94, 0.3)',
    borderWidth: 1
  },
  logoutBtnText: {
    color: '#F43F5E',
    fontSize: 12,
    fontWeight: 'bold'
  },
  listContent: {
    padding: 16
  },
  liveCard: {
    backgroundColor: '#0E1D33',
    borderColor: 'rgba(16, 185, 129, 0.4)',
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    marginBottom: 24,
    shadowColor: '#10B981',
    shadowOpacity: 0.15,
    shadowRadius: 10
  },
  liveHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  liveBadge: {
    backgroundColor: 'rgba(52, 211, 153, 0.2)',
    borderColor: '#34D399',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6
  },
  liveBadgeText: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '900'
  },
  liveSubtext: {
    color: '#64748B',
    fontSize: 11
  },
  liveTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4
  },
  liveDesc: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 14
  },
  pinRow: {
    flexDirection: 'row',
    gap: 8
  },
  pinInput: {
    flex: 1,
    backgroundColor: '#070D18',
    borderColor: '#1E2E48',
    borderWidth: 1,
    borderRadius: 12,
    color: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    fontWeight: 'bold'
  },
  joinBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12
  },
  joinBtnText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: 'bold'
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold'
  },
  sectionCount: {
    color: '#64748B',
    fontSize: 12
  },
  quizCard: {
    backgroundColor: '#0E1726',
    borderColor: '#1E2E48',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12
  },
  quizCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  categoryBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: 'rgba(56, 189, 248, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  categoryText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: 'bold'
  },
  difficultyText: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '600'
  },
  quizTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 4
  },
  quizDesc: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12
  },
  quizFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1A2840'
  },
  metaText: {
    color: '#64748B',
    fontSize: 11
  },
  startPill: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8
  },
  startPillText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: 'bold'
  },
  emptyBox: {
    padding: 40,
    alignItems: 'center'
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold'
  },
  emptySubtitle: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6
  }
});
