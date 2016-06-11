class InvalidCommitish(StandardError):
    def __init__(self, commitish):
        self.commitish = commitish

    def message(self):
        return "Couldn't resolve commitish %s" % self.commitish
