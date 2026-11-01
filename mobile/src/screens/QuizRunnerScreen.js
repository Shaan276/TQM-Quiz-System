import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert
} from 'react-native';
import { quizApi } from '../services/api';

export default function QuizRunnerScreen({ route, navigation }) {
  const { quizId, quizTitle } = route.params;
  const [loading, setLoading] = useState(true);
  const [attemptId, setAttemptId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({}); // { [qId]: ['A'] }
  const [timeLeft, setTimeLeft] = useState(600);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function startQuiz() {
      try {
        const res = await quizApi.startAttempt(quizId);
        if (res.success && res.data?.attempt) {
          setAttemptId(res.data.attempt.id);
          setQuestions(res.data.questions || []);
          if (res.data.attempt.time_limit_sec) {
            setTimeLeft(res.data.attempt.time_limit_sec);
          }
        } else {
          Alert.alert('Cannot Start Quiz', res.error?.message || 'Error initializing attempt', [
            { text: 'Back', onPress: () => navigation.goBack() }
          ]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    startQuiz();
  }, [quizId]);

  // Timer Countdown
  useEffect(() => {
    if (timeLeft <= 0) {
      handleFinishQuiz();
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const currentQ = questions[currentIndex];

  const handleSelectOption = async (optionKey) => {
    if (!currentQ || !attemptId) return;
    const isMulti = currentQ.type === 'MCQ_MULTI';
    const currentSelected = selectedAnswers[currentQ.id] || [];
    
    let updated;
    if (isMulti) {
      if (currentSelected.includes(optionKey)) {
        updated = currentSelected.filter(k => k !== optionKey);
      } else {
        updated = [...currentSelected, optionKey];
      }
    } else {
      updated = [optionKey];
    }

    setSelectedAnswers(prev => ({ ...prev, [currentQ.id]: updated }));
    // Persist answer to backend
    await quizApi.submitAnswer(attemptId, currentQ.id, updated, 5);
  };

  const handleFinishQuiz = async () => {
    if (!attemptId) return;
    setSubmitting(true);
    try {
      const res = await quizApi.finishAttempt(attemptId);
      if (res.success) {
        Alert.alert(
          'Quiz Completed!',
          `Score: ${res.data?.score || 0} / ${res.data?.total_marks || 0} (${res.data?.percentage || 0}%)\nStatus: ${res.data?.status || 'GRADED'}`,
          [{ text: 'Return Home', onPress: () => navigation.navigate('StudentHome') }]
        );
      } else {
        Alert.alert('Submission Error', res.error?.message || 'Failed to submit quiz');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>Loading Assessment Engine...</Text>
      </View>
    );
  }

  const formatTimer = (secs) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <View style={styles.container}>
      
      {/* Top Status Bar */}
      <View style={styles.statusBar}>
        <View>
          <Text style={styles.quizHeaderTitle} numberOfLines={1}>{quizTitle}</Text>
          <Text style={styles.progressText}>Question {currentIndex + 1} of {questions.length}</Text>
        </View>

        <View style={styles.timerBadge}>
          <Text style={styles.timerText}>⏱ {formatTimer(timeLeft)}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {currentQ ? (
          <View style={styles.questionCard}>
            
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>
                {currentQ.type === 'MCQ_MULTI' ? 'MULTIPLE CHOICE' : currentQ.type === 'TRUE_FALSE' ? 'TRUE / FALSE' : 'SINGLE CHOICE'}
              </Text>
              <Text style={styles.marksText}>{currentQ.marks || 1} mark(s)</Text>
            </View>

            <Text style={styles.questionPrompt}>{currentQ.text}</Text>

            {/* Options */}
            <View style={styles.optionsList}>
              {(currentQ.options || []).map((opt) => {
                const isSelected = (selectedAnswers[currentQ.id] || []).includes(opt.key);
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                    onPress={() => handleSelectOption(opt.key)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.optionKeyCircle, isSelected && styles.optionKeyCircleSelected]}>
                      <Text style={[styles.optionKeyText, isSelected && styles.optionKeyTextSelected]}>
                        {opt.key}
                      </Text>
                    </View>
                    <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                      {opt.text}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

          </View>
        ) : null}
      </ScrollView>

      {/* Bottom Navigation Controls */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.navBtn, currentIndex === 0 && styles.navBtnDisabled]}
          disabled={currentIndex === 0}
          onPress={() => setCurrentIndex(prev => prev - 1)}
        >
          <Text style={styles.navBtnText}>← Previous</Text>
        </TouchableOpacity>

        {currentIndex < questions.length - 1 ? (
          <TouchableOpacity
            style={styles.nextBtn}
            onPress={() => setCurrentIndex(prev => prev + 1)}
          >
            <Text style={styles.nextBtnText}>Next →</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.finishBtn}
            onPress={handleFinishQuiz}
            disabled={submitting}
          >
            <Text style={styles.finishBtnText}>{submitting ? 'Grading...' : 'Submit Final'}</Text>
          </TouchableOpacity>
        )}
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070D18'
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#070D18',
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    color: '#94A3B8',
    marginTop: 12,
    fontSize: 13
  },
  statusBar: {
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
  quizHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    maxWidth: 220
  },
  progressText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2
  },
  timerBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8
  },
  timerText: {
    color: '#FBBF24',
    fontSize: 12,
    fontWeight: 'bold'
  },
  scrollContent: {
    padding: 16
  },
  questionCard: {
    backgroundColor: '#0E1726',
    borderRadius: 20,
    borderColor: '#1E2E48',
    borderWidth: 1,
    padding: 18
  },
  typeBadge: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  typeBadgeText: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1
  },
  marksText: {
    color: '#64748B',
    fontSize: 11
  },
  questionPrompt: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    lineHeight: 22,
    marginBottom: 20
  },
  optionsList: {
    gap: 10
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121E36',
    borderColor: '#1F304E',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 12
  },
  optionCardSelected: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.1)'
  },
  optionKeyCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1B2A44',
    justifyContent: 'center',
    alignItems: 'center'
  },
  optionKeyCircleSelected: {
    backgroundColor: '#10B981'
  },
  optionKeyText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: 'bold'
  },
  optionKeyTextSelected: {
    color: '#000000'
  },
  optionText: {
    color: '#CBD5E1',
    fontSize: 14,
    flex: 1
  },
  optionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600'
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#0E1726',
    borderTopWidth: 1,
    borderTopColor: '#1E2E48'
  },
  navBtn: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#132238'
  },
  navBtnDisabled: {
    opacity: 0.4
  },
  navBtnText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: 'bold'
  },
  nextBtn: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#38BDF8'
  },
  nextBtnText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: 'bold'
  },
  finishBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#10B981'
  },
  finishBtnText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '900'
  }
});
