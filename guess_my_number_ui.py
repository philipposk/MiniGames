import tkinter as tk
from random import randint

class GuessMyNumber:
    def __init__(self):
        self.window = tk.Tk()
        self.window.title("Guess My Number")
        self.number_to_guess = randint(1, 100)
        self.attempts = 0

        self.label = tk.Label(self.window, text="Guess a number between 1 and 100:")
        self.label.pack()

        self.entry = tk.Entry(self.window)
        self.entry.pack()

        self.button = tk.Button(self.window, text="Guess", command=self.guess)
        self.button.pack()

        self.result_label = tk.Label(self.window, text="")
        self.result_label.pack()

    def guess(self):
        try:
            guess = int(self.entry.get())
            self.attempts += 1

            if guess < 1 or guess > 100:
                self.result_label.config(text="Please guess a number between 1 and 100.")
            elif guess < self.number_to_guess:
                self.result_label.config(text="Too low!")
            elif guess > self.number_to_guess:
                self.result_label.config(text="Too high!")
            else:
                self.result_label.config(text=f"Congratulations! You've guessed the number in {self.attempts} attempts.")
                self.button.config(state="disabled")
        except ValueError:
            self.result_label.config(text="Please enter a number.")

    def run(self):
        self.window.mainloop()

if __name__ == "__main__":
    game = GuessMyNumber()
    game.run()