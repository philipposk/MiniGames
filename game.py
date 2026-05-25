import random

def game():
    print("Welcome to the Adventure Game!")
    print("You are in a dark room. There is a door to your left and a door to your right.")
    choice = input("Which door do you choose? (left/right) ")
    if choice == "left":
        print("You found a treasure!")
    elif choice == "right":
        print("You found a dragon! You lose.")
    else:
        print("Invalid choice. Game over.")

if __name__ == '__main__':
    game()