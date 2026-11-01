import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert
} from 'react-native';
import { liveApi } from '../services/api';

export default function LiveSessionScreen({ route, navigation }) {
  const { pin } = route.params;
  const [sessionData, setSessionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    async function checkSession() {
      try {
        const res = await liveApi.lookupSessionByPin(pin);
        if (res.success && res.data?.session) {
          setSessionData(res.data.session);
          // Load leaderboard
          const lbRes = await liveApi.getLeaderboard(res.data.session.id);
          if (lbRes.success && lbRes.data?.leaderboard) {
            setLeaderboard(lbRes.data.leaderboard);
          }
        } else {
          Alert.alert('Session Not Found', 'No active live game found with this PIN.', [
            { text: 'OK', onPress: () => navigation.goBack() }
          ]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    checkSession();
  }, [pin]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.subtext}>Connecting to Live Multiplayer Room...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      
      {/* Top Banner */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Leave Room</Text>
        </TouchableOpacity>
        <View style={styles.pinPill}>
          <Text style={styles.pinText}>PIN: {pin}</Text>
        </View>
      </View>

      <View style={styles.content}>
        
        <View style={styles.lobbyCard}>
          <View style={styles.statusDotRow}>
            <View style={styles.greenDot} />
            <Text style={styles.statusText}>{sessionData?.status || 'LOBBY'}</Text>
          </View>

          <Text style={styles.quizName}>{sessionData?.quiz_title || 'Classroom Assessment'}</Text>
          <Text style={styles.lobbyDesc}>
            {sessionData?.status === 'LOBBY' 
              ? 'Waiting for instructor to begin the game on host screen...' 
              : 'Multiplayer Question Active! Look at main screen.'}
          </Text>
        </View>

        {/* Live Podium Leaderboard Preview */}
        <View style={styles.leaderboardBox}>
          <Text style={styles.lbHeader}>Live Podium &amp; Participants</Text>
          {leaderboard.length === 0 ? (
            <Text style={styles.noPlayersText}>Learners are gathering in lobby...</Text>
          ) : (
            leaderboard.map((player, idx) => (
              <View key={player.id || idx} style={styles.playerRow}>
                <Text style={styles.rankText}>#{idx + 1}</Text>
                <Text style={styles.playerName}>{player.participant_name || player.name}</Text>
                <Text style={styles.playerScore}>{player.score || 0} pts</Text>
              </View>
            ))
          )}
        </View>

      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070D18'
  },
  center: {
    flex: 1,
    backgroundColor: '#070D18',
    justifyContent: 'center',
    alignItems: 'center'
  },
  subtext: {
    color: '#94A3B8',
    marginTop: 12,
    fontSize: 13
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 14,
    backgroundColor: '#0E1726',
    borderBottomWidth: 1,
    borderBottomColor: '#1E2E48'
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10
  },
  backBtnText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: 'bold'
  },
  pinPill: {
    backgroundColor: 'rgba(52, 211, 153, 0.2)',
    borderColor: '#34D399',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8
  },
  pinText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '900'
  },
  content: {
    padding: 16
  },
  lobbyCard: {
    backgroundColor: '#0E1D33',
    borderColor: 'rgba(56, 189, 248, 0.4)',
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20
  },
  statusDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981'
  },
  statusText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1
  },
  quizName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 6
  },
  lobbyDesc: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18
  },
  leaderboardBox: {
    backgroundColor: '#0E1726',
    borderRadius: 20,
    borderColor: '#1E2E48',
    borderWidth: 1,
    padding: 16
  },
  lbHeader: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1B2A44'
  },
  noPlayersText: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 20
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#121E36'
  },
  rankText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: 'bold',
    width: 30
  },
  playerName: {
    color: '#FFFFFF',
    fontSize: 13,
    flex: 1
  },
  playerScore: {
    color: '#34D399',
    fontSize: 13,
    fontWeight: 'bold'
  }
});
