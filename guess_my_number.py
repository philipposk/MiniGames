import random

def guess_my_number():
    number_to_guess = random.randint(1, 100)
    attempts = 0

    print("Welcome to Guess My Number!")
    print("I'm thinking of a number between 1 and 100.")

    while True:
        try:
            guess = int(input("Take a guess: "))
            attempts += 1

            if guess < 1 or guess > 100:
                print("Please guess a number between 1 and 100.")
            elif guess < number_to_guess:
                print("Too low!")
            elif guess > number_to_guess:
                print("Too high!")
            else:
                print(f"Congratulations! You've guessed the number in {attempts} attempts.")
                play_again = input("Do you want to play again? (yes/no): ")
                if play_again.lower() == "yes":
                    number_to_guess = random.randint(1, 100)
                    attempts = 0
                else:
                    break
        except ValueError:
            print("Please enter a number.")

if __name__ == "__main__":
    guess_my_number()